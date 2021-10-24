"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GsubApp = exports.OutputFormat = void 0;
const tslib_1 = require("tslib");
const axios_1 = (0, tslib_1.__importDefault)(require("axios"));
const commander_1 = require("commander");
const sync_1 = (0, tslib_1.__importDefault)(require("csv-stringify/lib/sync"));
const fs_1 = require("fs");
const path_1 = require("path");
const utils_1 = require("../utils");
const certificate_report_1 = require("./certificate-report");
const pkg = require("./../../package.json");
var OutputFormat;
(function (OutputFormat) {
    OutputFormat["json"] = "json";
    OutputFormat["csv"] = "csv";
    OutputFormat["html"] = "html";
})(OutputFormat = exports.OutputFormat || (exports.OutputFormat = {}));
class GsubApp {
    constructor() {
        this.certificateReports = [];
        this.todoDomains = new Set();
        this.doneDomains = new Set();
        this.options = {
            maxDepthLevel: 0,
            outputFormat: OutputFormat.html,
            onlyResolved: false,
            denyList: [],
            resolve: false,
            initialTarget: "",
        };
        const program = new commander_1.Command();
        program
            .name("gsub")
            .usage("-t domain.tld -r -d google.com google.fr -o html > report.html")
            .description("Tool to retrieve SSL/TLS certificate reports information from the Google Transparency Report for a given domain.")
            .version(GsubApp.VERSION, "-v, --version", "output the current version")
            .requiredOption("-t, --target [domain]", "set the target domain")
            .addOption(new commander_1.Option("-l, --depth-level <level>", "set the depth level for the recursive domain discovery").default("0"))
            .addOption(new commander_1.Option("-o, --output-format [format]", "set the format for the report sent to stdout")
            .choices([OutputFormat.csv, OutputFormat.html, OutputFormat.json])
            .default("html"))
            .addOption(new commander_1.Option("-R, --only-resolved", "only output resolved domains"))
            .addOption(new commander_1.Option("-r, --resolve", "perform DNS and HTTP/S checks on domains"))
            .addOption(new commander_1.Option("-d, --deny-list [domain...]", "set the deny list for domains"))
            .parse();
        const opts = program.opts();
        (0, utils_1.log)(GsubApp.HEADER);
        (0, utils_1.log)(GsubApp.VERSION + "\n");
        let { depthLevel, outputFormat, onlyResolved, target, denyList, resolve } = opts;
        const maxDepthLevel = depthLevel === undefined || isNaN(+depthLevel)
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
    async getCertificateRecords(target = this.options.initialTarget, depthLevel = 0) {
        const { maxDepthLevel } = this.options;
        this.doneDomains.add(target);
        function parseGoogleResponse(res) {
            let rawData = res.data;
            const data = JSON.parse(rawData.slice(4))[0];
            let [, c, , f] = data;
            return {
                certs: c,
                footer: f,
            };
        }
        let nextPage = null;
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
                const response = await axios_1.default.get(URL, {
                    params,
                });
                const { certs, footer } = parseGoogleResponse(response);
                const pageCount = +footer[4];
                if (!nextPage) {
                    (0, utils_1.log)(`Start processing ${pageCount * 10} reports for ${target}`, utils_1.Color.FgCyan);
                }
                const currentPage = +footer[3];
                for (let i = 0; i < certs.length; i++) {
                    const cert = certs[i];
                    try {
                        const certificateReport = new certificate_report_1.CertificateReport(cert, this, target);
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
                        const currentMultiplier = (value) => {
                            return certs.length === 10
                                ? 10 * value
                                : 10 * (value - 1) + certs.length;
                        };
                        let color = resolvedIpAddress ? utils_1.Color.FgYellow : utils_1.Color.FgWhite;
                        color = httpStatus === 200 ? utils_1.Color.FgGreen : color;
                        (0, utils_1.log)(`${target} - ${i + 1 + currentMultiplier(currentPage - 1)}/${currentMultiplier(pageCount)} - ${commonName} - ${resolvedIpAddress ? resolvedIpAddress : "not resolved"}`, color);
                        this.certificateReports.push(certificateReport);
                    }
                    catch (err) {
                        continue;
                    }
                }
                nextPage = footer[1];
            }
            catch (err) {
                // skipping
            }
        } while (nextPage);
        if (depthLevel !== maxDepthLevel) {
            const ops = [];
            const todoDomains = [...this.todoDomains];
            for (const domain of todoDomains) {
                if (this.doneDomains.has(domain))
                    continue;
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
                (0, utils_1.output)(JSON.stringify(this.certificateReports));
                break;
            case OutputFormat.csv:
                const columns = [
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
                (0, utils_1.output)((0, sync_1.default)(this.certificateReports, {
                    columns,
                    header: true,
                    bom: true,
                    record_delimiter: "windows",
                    cast: {
                        date(value) {
                            return value.toISOString();
                        },
                    },
                }));
                break;
            case OutputFormat.html:
                return (0, utils_1.output)(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report</title>
  <style>  
    ${(0, fs_1.readFileSync)((0, path_1.join)(process.cwd(), "assets", "css", "index.css")).toString()}    
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
  ${(0, fs_1.readFileSync)((0, path_1.join)(process.cwd(), "assets", "js", "index.js")).toString()}

  var baseChartData = JSON.parse('${JSON.stringify(this.certificateReports.map((item) => ({
                    ...item,
                    date: item.lastIssuanceDate ? item.lastIssuanceDate.toISOString() : null,
                })))}');
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
exports.GsubApp = GsubApp;
GsubApp.HEADER = "\n\
  __ _ ___ _   _| |__  \n\
 / _` / __| | | | '_ \\ \n\
| (_| \\__ \\ |_| | |_) |\n\
 \\__, |___/\\__,_|_.__/ \n\
 |___/";
GsubApp.VERSION = pkg.version;
GsubApp.DEFAULT_DEPTH_LEVEL = 0;
GsubApp.DEFAULT_OUTPUT_FORMAT = OutputFormat.html;
GsubApp.GOOGLE_BASE_URL = "https://transparencyreport.google.com/transparencyreport/api/v3/httpsreport/ct/certsearch";
//# sourceMappingURL=gsub-app.js.map