import axios, { AxiosResponse } from 'axios';
import { Command, Option } from 'commander';
import stringify from 'csv-stringify/lib/sync';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Color, log, output } from '../utils';
import { CertificateReport } from './certificate-report';
const pkg = require('./../../package.json');

export interface GsubOptions {
  maxDepthLevel: number;
  outputFormat: OutputFormat;
  onlyResolved: boolean;
  denyList: string[];
  initialTarget: string;
}

export enum OutputFormat {
  json = 'json',
  csv = 'csv',
  html = 'html',
}

interface ChartData {
  id: string;
  name: string;
  value?: number;
  linkWith: string[];
  children: {
    id: string;
    name: string;
    value?: number;
    linkWith: string[];
    status: number | null;
    ipAddr: string | null;
  }[];
}

export class GsubApp {
  static readonly HEADER =
    "\n\
  __ _ ___ _   _| |__  \n\
 / _` / __| | | | '_ \\ \n\
| (_| \\__ \\ |_| | |_) |\n\
 \\__, |___/\\__,_|_.__/ \n\
 |___/";
  static readonly VERSION = pkg.version;
  static readonly DEFAULT_DEPTH_LEVEL = 0;
  static readonly DEFAULT_OUTPUT_FORMAT = OutputFormat.html;
  static readonly GOOGLE_BASE_URL =
    'https://transparencyreport.google.com/transparencyreport/api/v3/httpsreport/ct/certsearch';

  public certificateReports: CertificateReport[] = [];
  public todoDomains: string[] = [];
  public doneDomains: string[] = [];

  public options: GsubOptions = {
    maxDepthLevel: 0,
    outputFormat: OutputFormat.html,
    onlyResolved: false,
    denyList: [],
    initialTarget: '',
  };

  constructor() {
    const program = new Command();
    program
      .name('gsub')
      .usage('-t domain.tld -d google.com google.fr -o json > report.json')
      .description(
        'Tool to retrieve SSL/TLS certificate reports information from the Google Transparency Report for a given domain.'
      )
      .version(GsubApp.VERSION, '-v, --version', 'output the current version')
      .requiredOption('-t, --target [domain]', 'set the target domain')
      .addOption(
        new Option(
          '-l, --depth-level <level>',
          'set the depth level for the recursive domain discovery'
        ).default('0')
      )
      .addOption(
        new Option(
          '-o, --output-format [format]',
          'set the format for the report sent to stdout'
        )
          .choices([OutputFormat.csv, OutputFormat.html, OutputFormat.json])
          .default('html')
      )
      .addOption(
        new Option('-r, --only-resolved', 'only output resolved domain')
      )
      .addOption(
        new Option(
          '-d, --deny-list [domain...]',
          'set the deny list for domain'
        )
      )
      .parse();

    const opts = program.opts();

    log(GsubApp.HEADER);
    log(GsubApp.VERSION + '\n');

    let { depthLevel, outputFormat, onlyResolved, target, denyList } = opts;

    const maxDepthLevel =
      depthLevel === undefined || isNaN(+depthLevel)
        ? GsubApp.DEFAULT_DEPTH_LEVEL
        : +depthLevel;

    if (!(outputFormat in OutputFormat)) {
      outputFormat = OutputFormat.html;
    }

    onlyResolved = !!onlyResolved;

    if (!Array.isArray(denyList)) {
      denyList = [];
    }

    this.options = {
      maxDepthLevel,
      outputFormat,
      onlyResolved,
      denyList,
      initialTarget: target,
    };
  }

  async getCertificateRecords(
    target: string = this.options.initialTarget,
    depthLevel: number = 0
  ): Promise<void> {
    const { maxDepthLevel } = this.options;

    this.doneDomains.push(target);

    function parseGoogleResponse(res: AxiosResponse): {
      certs: Array<string>;
      footer: Array<string>;
    } {
      let rawData = res.data as string;
      const data = JSON.parse(rawData.slice(4))[0] as Array<Array<string>>;
      let [, c, , f] = data;
      return {
        certs: c,
        footer: f,
      };
    }

    let nextPage: string | null = null;

    do {
      const URL = nextPage
        ? GsubApp.GOOGLE_BASE_URL + '/page'
        : GsubApp.GOOGLE_BASE_URL;
      const params = nextPage
        ? {
            p: nextPage,
          }
        : {
            include_subdomains: true,
            domain: target,
          };

      try {
        const response = await axios.get(URL, {
          params,
        });
        const { certs, footer } = parseGoogleResponse(response);
        const pageCount = +footer[4];
        if (!nextPage) {
          log(
            `Start processing ${pageCount * 10} reports for ${target}`,
            Color.FgCyan
          );
        }
        const currentPage = +footer[3];
        for (let i = 0; i < certs.length; i++) {
          const cert = certs[i];
          try {
            const certificateReport = new CertificateReport(cert, this, target);
            const [ipAddr, httpStatus] = await Promise.all([
              certificateReport.resolve(),
              certificateReport.getHttpStatus(),
            ]);
            if (this.options.onlyResolved && !ipAddr) {
              continue;
            }
            const { commonName, resolvedIpAddress } = certificateReport;
            const currentMultiplier = (value: number): number => {
              return certs.length === 10
                ? 10 * value
                : 9 * value + certs.length;
            };
            let color = resolvedIpAddress ? Color.FgYellow : Color.FgWhite;
            color = httpStatus === 200 ? Color.FgGreen : color;
            log(
              `${target} - ${
                i + 1 + currentMultiplier(currentPage - 1)
              }/${currentMultiplier(pageCount)} - ${commonName} - ${
                resolvedIpAddress ? resolvedIpAddress : 'not resolved'
              }`,
              color
            );
            this.certificateReports.push(certificateReport);
          } catch (err) {
            continue;
          }
        }
        nextPage = footer[1];
      } catch (err) {
        // skipping
      }
    } while (nextPage);

    if (depthLevel !== maxDepthLevel) {
      const ops = [];
      for (const domain of this.todoDomains) {
        ops.push(this.getCertificateRecords(domain, depthLevel + 1));
      }
      await Promise.all(ops);
    }
  }

  outputCertificateReports() {
    switch (this.options.outputFormat) {
      case OutputFormat.json:
        output(JSON.stringify(this.certificateReports));
        break;
      case OutputFormat.csv:
        const columns: Array<{
          key: keyof CertificateReport;
          header: string;
        }> = [
          {
            key: 'queriedDomain',
            header: 'Queried domain',
          },
          {
            key: 'domain',
            header: 'Domain',
          },
          {
            key: 'commonName',
            header: 'Common name',
          },
          {
            key: 'lastIssuanceDate',
            header: 'Last certificate issuance date',
          },
          {
            key: 'resolvedIpAddress',
            header: 'Resolved IP address',
          },
          {
            key: 'httpStatus',
            header: 'HTTP status (GET / port 80)',
          },
        ];
        output(
          stringify(this.certificateReports, {
            columns,
            header: true,
            bom: true,
            record_delimiter: 'windows',
            cast: {
              date(value) {
                return value.toISOString();
              },
            },
          })
        );
        break;
      case OutputFormat.html:
        return output(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report</title>
  <style>  
    ${readFileSync(
      join(process.cwd(), 'assets', 'css', 'index.css')
    ).toString()}    
  </style>
</head>
<body>
  <main>
    <div id="chartdiv"></div>
    <nav>
      <input type="radio" name="chartMode" id="domains" oninput="changeChartMode('domains')" />
      <label class="radio-label" for="domains">Domains</label>
      <input type="radio" name="chartMode" id="domains-with-links" oninput="changeChartMode('domainsWithLinks')" checked />
      <label class="radio-label" for="domains-with-links">Domains with links</label>
      <input type="radio" name="chartMode" id="ips" oninput="changeChartMode('ips')" />
      <label class="radio-label" for="ips">Ips</label>
      <label class="date-label" for="start">Last issued at from</label>
      <input type="date" id="start" name="start" oninput="filterChartDataOnDate(event)" />
      <label class="date-label" for="end">Until</label>
      <input type="date" id="end" name="end" oninput="filterChartDataOnDate(event)" />
      </nav>
  </main>
</body>
<script src="https://cdn.amcharts.com/lib/4/core.js"></script>
<script src="https://cdn.amcharts.com/lib/4/charts.js"></script>
<script src="https://cdn.amcharts.com/lib/4/plugins/forceDirected.js"></script> 
<script src="https://cdn.amcharts.com/lib/4/themes/animated.js"></script>
<script>
  ${readFileSync(join(process.cwd(), 'assets', 'js', 'index.js')).toString()}

  var baseChartData = JSON.parse('${JSON.stringify(
    this.certificateReports.map((item) => ({
      ...item,
      date: item.lastIssuanceDate ? item.lastIssuanceDate.toISOString() : null,
    }))
  )}');
  var chartMode = 'domains';

  function changeChartMode(mode) {
    if(!['domains', 'domainsWithLinks', 'ips'].includes(mode)) return;
    chartMode = mode;
    switch(chartMode) {
      case 'domains':
        setupChart({mode: 'domains'});
        break;
      case 'domainsWithLinks':
        setupChart({mode: 'domains', link: true});
        break;
      case 'ips':
        setupChart({mode: 'ips'});
        break;
    }
  }

  changeChartMode('domainsWithLinks');
</script>
</html>
`);
      default:
        break;
    }
  }
}
