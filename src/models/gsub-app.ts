import axios, { AxiosResponse } from "axios";
import { Command, Option } from "commander";
import stringify from "csv-stringify/lib/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "path/posix";
import { Color, log, output } from "../utils";
import { CertificateReport } from "./certificate-report";
const pkg = require("./../../package.json");

export interface GsubOptions {
  maxDepthLevel: number;
  outputFormat: OutputFormat;
  onlyResolved: boolean;
  resolve: boolean;
  denyList: string[];
  initialTarget: string;
}

export enum OutputFormat {
  json = "json",
  csv = "csv",
  html = "html",
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
    "https://transparencyreport.google.com/transparencyreport/api/v3/httpsreport/ct/certsearch";

  public certificateReports: CertificateReport[] = [];
  public todoDomains: Set<string> = new Set();
  public doneDomains: Set<string> = new Set();

  public options: GsubOptions = {
    maxDepthLevel: 0,
    outputFormat: OutputFormat.html,
    onlyResolved: false,
    denyList: [],
    resolve: false,
    initialTarget: "",
  };

  constructor() {
    const program = new Command();
    program
      .name("gsub")
      .usage("-t domain.tld -r -d google.com google.fr -o html > report.html")
      .description(
        "Tool to retrieve SSL/TLS certificate reports information from the Google Transparency Report for a given domain."
      )
      .version(GsubApp.VERSION, "-v, --version", "output the current version")
      .requiredOption("-t, --target [domain]", "set the target domain")
      .addOption(
        new Option(
          "-l, --depth-level <level>",
          "set the depth level for the recursive domain discovery"
        ).default("0")
      )
      .addOption(
        new Option(
          "-o, --output-format [format]",
          "set the format for the report sent to stdout"
        )
          .choices([OutputFormat.csv, OutputFormat.html, OutputFormat.json])
          .default("html")
      )
      .addOption(
        new Option("-R, --only-resolved", "only output resolved domains")
      )
      .addOption(
        new Option("-r, --resolve", "perform DNS and HTTP/S checks on domains")
      )
      .addOption(
        new Option(
          "-d, --deny-list [domain...]",
          "set the deny list for domains"
        )
      )
      .parse();

    const opts = program.opts();

    log(GsubApp.HEADER);
    log(GsubApp.VERSION + "\n");

    let { depthLevel, outputFormat, onlyResolved, target, denyList, resolve } =
      opts;

    const maxDepthLevel =
      depthLevel === undefined || isNaN(+depthLevel)
        ? GsubApp.DEFAULT_DEPTH_LEVEL
        : +depthLevel;

    if (!(outputFormat in OutputFormat)) {
      outputFormat = OutputFormat.html;
    }

    onlyResolved = !!onlyResolved;
    resolve = !!resolve;

    if (!Array.isArray(denyList)) {
      denyList = [];
    }

    this.options = {
      maxDepthLevel,
      outputFormat,
      onlyResolved,
      denyList,
      resolve,
      initialTarget: target,
    };
  }

  async getCertificateRecords(
    target: string = this.options.initialTarget,
    depthLevel: number = 0
  ): Promise<void> {
    const { maxDepthLevel } = this.options;

    this.doneDomains.add(target);

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
        ? GsubApp.GOOGLE_BASE_URL + "/page"
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
            const [ipAddr, httpStatus] = this.options.resolve
              ? await Promise.all([
                  certificateReport.resolve(),
                  certificateReport.getHttpStatus(),
                ])
              : [undefined, undefined];
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
                resolvedIpAddress ? resolvedIpAddress : "not resolved"
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
      const todoDomains = [...this.todoDomains];
      for (const domain of todoDomains) {
        if (this.doneDomains.has(domain)) continue;
        ops.push(this.getCertificateRecords(domain, depthLevel + 1));
        this.doneDomains.add(domain);
        this.todoDomains.delete(domain);
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
            key: "queriedDomain",
            header: "Queried domain",
          },
          {
            key: "domain",
            header: "Domain",
          },
          {
            key: "commonName",
            header: "Common name",
          },
          {
            key: "lastIssuanceDate",
            header: "Last certificate issuance date",
          },
          {
            key: "resolvedIpAddress",
            header: "Resolved IP address",
          },
          {
            key: "httpStatus",
            header: "HTTP/S status (GET)",
          },
        ];
        output(
          stringify(this.certificateReports, {
            columns,
            header: true,
            bom: true,
            record_delimiter: "windows",
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
      join(process.cwd(), "assets", "css", "index.css")
    ).toString()}    
  </style>
</head>
<body>
  <main>
    <div id="chartdiv"></div>
    <nav>
      <ul>
        <li>
          <input type="radio" name="chartMode" id="domains" oninput="changeChartMode('domains')" checked />
          <label class="radio-label" for="domains">Domains</label>
        </li>
        <li>
          <input type="radio" name="chartMode" id="ips" oninput="changeChartMode('ips')" />
          <label class="radio-label" for="ips">Ips</label>
        </li>
        <li>
          <input type="radio" name="chartMode" id="wordcoud" oninput="changeChartMode('wordcloud')" />
          <label class="radio-label" for="wordcoud">Wordcloud</label>
        </li>
      </ul>
      <ul>
        <li id="domains-choices" style="visibility: 'hidden';">
          <input type="checkbox" name="domains-links" id="domains-links" oninput="changeChartOptions({ links: event.target.checked })" checked />
          <label class="radio-label" for="domains-links">Links between domains</label>
        </li>
        <li id="wordcloud-choices" style="visibility: 'hidden';">
          <input type="checkbox" name="wordcloud-links" id="wordcloud-links" oninput="changeChartOptions({
            links: event.target.checked,
            domains: document.getElementById('wordcloud-domains').checked,
          })" checked />
          <label class="radio-label" for="wordcloud-links">Links between words</label>
          <input type="checkbox" name="wordcloud-domains" id="wordcloud-domains" oninput="changeChartOptions({
            links: document.getElementById('wordcloud-links').checked,
            domains: event.target.checked,
          })" />
          <label class="radio-label" for="wordcloud-domains">Show domains</label>
        </li>
        <li>
          <label class="date-label" for="start">Last issuance date between</label>
          <input type="date" id="start" name="start" oninput="filterChartDataOnDate(event)" />
          <label class="date-label" for="end">and</label>
          <input type="date" id="end" name="end" oninput="filterChartDataOnDate(event)" />
        </li>
      </ul>
      </nav>
  </main>
</body>
<script src="https://cdn.amcharts.com/lib/4/core.js"></script>
<script src="https://cdn.amcharts.com/lib/4/charts.js"></script>
<script src="https://cdn.amcharts.com/lib/4/plugins/forceDirected.js"></script> 
<script src="https://cdn.amcharts.com/lib/4/themes/animated.js"></script>
<script>
  ${readFileSync(join(process.cwd(), "assets", "js", "index.js")).toString()}

  var baseChartData = JSON.parse('${JSON.stringify(
    this.certificateReports.map((item) => ({
      ...item,
      date: item.lastIssuanceDate ? item.lastIssuanceDate.toISOString() : null,
    }))
  )}');
  var chartMode = 'domains';

  function changeChartMode(mode, options) {
    if(!['domains', 'ips', 'wordcloud'].includes(mode)) return;
    chartMode = mode;
    switch(chartMode) {
      case 'domains':
        toggleChoicesVisibility('domains', 'list-item');
        toggleChoicesVisibility('wordcloud', 'none');
        setupChart({...(options ? options : { links: true }), mode: 'domains'});
        break;
      case 'ips':
        toggleChoicesVisibility('wordcloud', 'none');
        toggleChoicesVisibility('domains', 'none');
        setupChart({...(options ? options : {}), mode: 'ips'});
        break;
      case 'wordcloud':
        toggleChoicesVisibility('wordcloud', 'list-item');
        toggleChoicesVisibility('domains', 'none');
        setupChart({...(options ? options : { links: true }), mode: 'wordcloud'});
        break;
    }
  }

  function changeChartOptions(options) {
    changeChartMode(chartMode, options);
  }

  changeChartMode('domains');
</script>
</html>
`);
      default:
        break;
    }
  }
}
