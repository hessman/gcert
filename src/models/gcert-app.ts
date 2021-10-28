import axios, { AxiosResponse } from "axios";
import { Command, Option } from "commander";
import stringify from "csv-stringify/lib/sync";
import { readFileSync } from "fs";
import { join } from "path";
import psl from "psl";
import { Color, log, output } from "../utils";
import { GcertItem } from "./gcert-item";
const pkg = require("./../../package.json");

export interface GcertOptions {
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

export type GoogleCertificateList = [
  [
    _: string,
    items: GoogleCertificateListCertificateItem[],
    _2: unknown,
    footer: GoogleCertificateListFooter
  ]
];

export type GoogleCertificateListCertificateItem = [
  _: unknown | null,
  subject: string,
  issuer: string,
  validFromTimestamp: number,
  validToTimestamp: number,
  detailsId: string,
  dnsNamesCount: number,
  _2: unknown | null,
  ctLogsCount: number
];

export type GoogleCertificateListFooter = [
  previousPageId: string,
  nextPageId: string,
  _: unknown | null,
  currentPage: number,
  pageCount: number
];

export type GoogleCertificateDetail = [
  [
    _: string,
    item: GoogleCertificateDetailItem,
    ctLogs: GoogleCertificateDetailCtLog
  ]
];

export type GoogleCertificateDetailItem = [
  serialNumber: string,
  subject: string,
  issuer: string,
  validFromTimestamp: number,
  validToTimestamp: number,
  _: unknown | null,
  _2: unknown | null,
  dnsNames: string[]
];

export type GoogleCertificateDetailCtLog = [
  name: string,
  _: unknown | null,
  _2: number
];

export class GcertApp {
  static readonly HEADER =
    "\n\
  __ _  ___ ___ _ __| |_ \n\
 / _` |/ __/ _ \\ '__| __|\n\
| (_| | (_|  __/ |  | |_ \n\
 \\__, |\\___\\___|_|   \\__|\n\
 |___/";
  static readonly VERSION = pkg.version;
  static readonly DEFAULT_DEPTH_LEVEL = 0;
  static readonly DEFAULT_OUTPUT_FORMAT = OutputFormat.html;
  static readonly GOOGLE_BASE_URL =
    "https://transparencyreport.google.com/transparencyreport/api/v3/httpsreport/ct";

  public items: GcertItem[] = [];
  public todoDomains: Set<string> = new Set();
  public doneDomains: Set<string> = new Set();

  public options: GcertOptions = {
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
      .name("gcert")
      .usage("-t domain.tld -r -d google.com google.fr -o html > report.html")
      .description(
        "Tool to retrieve SSL/TLS certificate reports information from the Google Transparency Report for a given domain."
      )
      .version(GcertApp.VERSION, "-v, --version", "output the current version")
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

    log(GcertApp.HEADER);
    log(GcertApp.VERSION + "\n");

    let { depthLevel, outputFormat, onlyResolved, target, denyList, resolve } =
      opts;

    const maxDepthLevel =
      depthLevel === undefined || isNaN(+depthLevel)
        ? GcertApp.DEFAULT_DEPTH_LEVEL
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

    function parseGoogleSearchResponse(res: AxiosResponse): {
      certs: GoogleCertificateListCertificateItem[];
      footer: GoogleCertificateListFooter;
    } {
      let rawData = res.data as string;
      const data = (JSON.parse(rawData.slice(4)) as GoogleCertificateList)[0];
      let [, c, , f] = data;
      return {
        certs: c,
        footer: f,
      };
    }

    function parseGoogleDetailsResponse(res: AxiosResponse): {
      details: GoogleCertificateDetailItem;
    } {
      let rawData = res.data as string;
      const data = (JSON.parse(rawData.slice(4)) as GoogleCertificateDetail)[0];
      let [, d] = data;
      return {
        details: d,
      };
    }

    let nextPage: string | null = null;
    let previousPage: string | null = null;

    do {
      previousPage = nextPage;
      const URL = nextPage
        ? GcertApp.GOOGLE_BASE_URL + "/certsearch/page"
        : GcertApp.GOOGLE_BASE_URL + "/certsearch";
      const params = nextPage
        ? {
            p: nextPage,
          }
        : {
            include_subdomains: true,
            domain: target,
          };

      try {
        const { certs, footer } = parseGoogleSearchResponse(
          await axios.get(URL, {
            params,
          })
        );
        const pageCount = +footer[4];
        if (!nextPage) {
          log(
            `Start processing ${pageCount * 10} reports for ${target}`,
            Color.FgCyan
          );
        }
        const currentPage = +footer[3];
        const pagePromises = [];
        for (let i = 0; i < certs.length; i++) {
          const handleCertificateRecord = async (
            cert: GoogleCertificateListCertificateItem,
            index: number
          ) => {
            if (!cert[5]) return;

            try {
              const { details } = parseGoogleDetailsResponse(
                await axios.get(GcertApp.GOOGLE_BASE_URL + "/certbyhash", {
                  params: {
                    hash: cert[5],
                  },
                })
              );

              const dnsNamesWithDomain = [];
              const domains: Set<string> = new Set();
              for (const dnsName of details[7]) {
                const domain = psl.get(dnsName);
                if (!domain) continue;
                domains.add(domain);
                dnsNamesWithDomain.push({
                  domain,
                  dnsName,
                });
              }

              for (const { domain, dnsName } of dnsNamesWithDomain) {
                const item = new GcertItem(
                  {
                    dnsName,
                    domain,
                    queriedDomain: target,
                    issuanceDate: new Date(details[3]),
                    domains,
                  },
                  this
                );
                const [ipAddr, httpStatus] = this.options.resolve
                  ? await Promise.all([item.resolve(), item.getHttpStatus()])
                  : [undefined, undefined];
                if (this.options.onlyResolved && !ipAddr) {
                  continue;
                }
                const { resolvedIpAddress } = item;
                const currentMultiplier = (value: number): number => {
                  return certs.length === 10
                    ? 10 * value
                    : 10 * (value - 1) + certs.length;
                };
                let color = resolvedIpAddress ? Color.FgYellow : Color.FgWhite;
                color = httpStatus === 200 ? Color.FgGreen : color;
                log(
                  `${target} - ${
                    index + 1 + currentMultiplier(currentPage - 1)
                  }/${currentMultiplier(pageCount)} - ${dnsName} - ${
                    resolvedIpAddress ? resolvedIpAddress : "not resolved"
                  }`,
                  color
                );
                this.items.push(item);
              }
            } catch (err) {
              return;
            }
          };
          pagePromises.push(handleCertificateRecord(certs[i], i));
        }
        await Promise.all(pagePromises);
        nextPage = footer[1];
      } catch (err) {
        if (previousPage === nextPage) break;
      }
    } while (nextPage);

    if (depthLevel !== maxDepthLevel) {
      const domainPromises = [];
      const todoDomains = [...this.todoDomains];
      for (const domain of todoDomains) {
        if (this.doneDomains.has(domain)) continue;
        domainPromises.push(this.getCertificateRecords(domain, depthLevel + 1));
        this.doneDomains.add(domain);
        this.todoDomains.delete(domain);
      }
      await Promise.all(domainPromises);
    }
  }

  outputCertificateReports() {
    switch (this.options.outputFormat) {
      case OutputFormat.json:
        output(JSON.stringify(this.items));
        break;
      case OutputFormat.csv:
        const columns: Array<{
          key: keyof GcertItem;
          header: string;
        }> = [
          {
            key: "queriedDomain",
            header: "Queried domain",
          },
          {
            key: "domains",
            header: "Domains",
          },
          {
            key: "dnsName",
            header: "DNS name",
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
          stringify(this.items, {
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
          <input type="checkbox" name="domains-links" id="domains-links" oninput="filterChartDataOn(event)" checked />
          <label class="radio-label" for="domains-links">Links between domains</label>
        </li>
        <li id="wordcloud-choices" style="visibility: 'hidden';">
          <input type="checkbox" name="wordcloud-links" id="wordcloud-links" oninput="filterChartDataOn(event)" checked />
          <label class="radio-label" for="wordcloud-links">Links between words</label>
          <input type="checkbox" name="wordcloud-domains" id="wordcloud-domains" oninput="filterChartDataOn(event)" />
          <label class="radio-label" for="wordcloud-domains">Show domains</label>
          <input type="checkbox" name="wordcloud-only-words" id="wordcloud-only-words" oninput="changeChartOptions({ onlyWords: event.target.checked })" checked />
          <label class="radio-label" for="wordcloud-only-words">Words only</label>
        </li>
        <li id="global-choices" style="visibility: 'hidden';">
          <input type="checkbox" name="global-only-resolved" id="global-only-resolved" oninput="filterChartDataOn(event)" />
          <label class="radio-label" for="global-only-resolved">Only resolved</label>
        </li>
        <li>
          <label class="date-label" for="start">Last issuance date between</label>
          <input type="date" id="start" name="start" oninput="filterChartDataOn(event)" />
          <label class="date-label" for="end">and</label>
          <input type="date" id="end" name="end" oninput="filterChartDataOn(event)" />
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
    this.items.map((item) => ({
      ...item,
      date: item.lastIssuanceDate ? item.lastIssuanceDate.toISOString() : null,
    }))
  )}');
  var chartMode = 'domains';
  var chartOptions = null;

  function changeChartMode(mode) {
    if(!['domains', 'ips', 'wordcloud'].includes(mode)) return;
    chartMode = mode;
    if(mode !== chartMode) {
      chartOptions = null;
      if(mode === 'wordcloud') {
        filterChartDataOn({ target: { checked: true, id: 'wordcloud-links' } });
      }
    }
    switch(chartMode) {
      case 'domains':
        chartOptions = chartOptions ? chartOptions : {};
        toggleChoicesVisibility('domains', 'list-item');
        toggleChoicesVisibility('wordcloud', 'none');
        setupChart({...chartOptions, mode: 'domains'});
        break;
      case 'ips':
        chartOptions = chartOptions ? chartOptions : {};
        toggleChoicesVisibility('wordcloud', 'none');
        toggleChoicesVisibility('domains', 'none');
        setupChart({...chartOptions, mode: 'ips'});
        break;
      case 'wordcloud':
        chartOptions = chartOptions ? chartOptions : { onlyWords: true };
        toggleChoicesVisibility('wordcloud', 'list-item');
        toggleChoicesVisibility('domains', 'none');
        setupChart({...chartOptions, mode: 'wordcloud'});
        break;
    }
  }

  function changeChartOptions(options) {
    chartOptions = { ...(chartOptions ? chartOptions : {}), ...options };
    changeChartMode(chartMode);
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
