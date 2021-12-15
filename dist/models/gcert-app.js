"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GcertApp = exports.OutputFormat = void 0;
const tslib_1 = require("tslib");
const axios_1 = (0, tslib_1.__importDefault)(require("axios"));
const commander_1 = require("commander");
const sync_1 = (0, tslib_1.__importDefault)(require("csv-stringify/lib/sync"));
const path_1 = require("path");
const psl_1 = (0, tslib_1.__importDefault)(require("psl"));
const utils_1 = require("../utils");
const gcert_item_1 = require("./gcert-item");
const pug_1 = require("pug");
const pkg = require("./../../package.json");
var OutputFormat;
(function (OutputFormat) {
    OutputFormat["json"] = "json";
    OutputFormat["csv"] = "csv";
    OutputFormat["html"] = "html";
    OutputFormat["none"] = "none";
})(OutputFormat = exports.OutputFormat || (exports.OutputFormat = {}));
class GcertApp {
    constructor() {
        this.items = [];
        this.todoDomains = new Set();
        this.doneDomains = new Set();
        this.options = {
            maxDepthLevel: 0,
            outputFormat: OutputFormat.html,
            onlyResolved: false,
            domainDenyList: [],
            wordDenyList: [],
            resolve: false,
            initialTarget: "",
        };
        const program = new commander_1.Command();
        program
            .name("gcert")
            .usage("-t domain.tld -r -d google.com google.fr -o html > report.html")
            .description("Retrieves SSL/TLS certificate reports information from the Google Transparency Report for a given domain.")
            .version(GcertApp.VERSION, "-v, --version", "output the current version")
            .helpOption("-h, --help", "output usage information")
            .requiredOption("-t, --target [domain]", "set the target domain")
            .addOption(new commander_1.Option("-l, --depth-level <level>", "set the depth level for the recursive domain discovery").default("0"))
            .addOption(new commander_1.Option("-o, --output-format [format]", "set the format for the report sent to stdout")
            .choices([
            OutputFormat.csv,
            OutputFormat.html,
            OutputFormat.json,
            OutputFormat.none,
        ])
            .default("none"))
            .addOption(new commander_1.Option("-R, --only-resolved", "only output resolved domains"))
            .addOption(new commander_1.Option("-r, --resolve", "perform DNS and HTTP/S checks on domains"))
            .addOption(new commander_1.Option("-d, --domain-deny-list [domain...]", "set the deny list for domains"))
            .addOption(new commander_1.Option("-wd, --word-deny-list [word...]", "set the deny list for words"))
            .parse();
        const opts = program.opts();
        (0, utils_1.log)(GcertApp.HEADER);
        (0, utils_1.log)(GcertApp.VERSION + "\n");
        let { depthLevel, outputFormat, onlyResolved, target, domainDenyList, wordDenyList, resolve, } = opts;
        const maxDepthLevel = depthLevel === undefined || isNaN(+depthLevel)
            ? GcertApp.DEFAULT_DEPTH_LEVEL
            : +depthLevel;
        if (!(outputFormat in OutputFormat)) {
            outputFormat = OutputFormat.none;
        }
        onlyResolved = !!onlyResolved;
        resolve = !!resolve;
        if (!Array.isArray(domainDenyList)) {
            domainDenyList = [];
        }
        if (!Array.isArray(wordDenyList)) {
            wordDenyList = [];
        }
        this.options = {
            maxDepthLevel,
            outputFormat,
            onlyResolved,
            domainDenyList,
            wordDenyList,
            resolve,
            initialTarget: target.toLowerCase(),
        };
    }
    async getCertificateRecords(target = this.options.initialTarget, depthLevel = 0) {
        const { maxDepthLevel } = this.options;
        this.doneDomains.add(target);
        function parseGoogleSearchResponse(res) {
            let rawData = res.data;
            const data = JSON.parse(rawData.slice(4))[0];
            let [, c, , f] = data;
            return {
                certs: c,
                footer: f,
            };
        }
        function parseGoogleDetailsResponse(res) {
            let rawData = res.data;
            const data = JSON.parse(rawData.slice(4))[0];
            let [, d] = data;
            return {
                details: d,
            };
        }
        let nextPage = null;
        let previousPage = null;
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
                const { certs, footer } = parseGoogleSearchResponse(await axios_1.default.get(URL, {
                    params,
                }));
                const pageCount = +footer[4];
                if (!nextPage) {
                    (0, utils_1.log)(`Start processing ${pageCount * 10} reports for ${target}`, utils_1.Color.FgCyan);
                }
                const currentPage = +footer[3];
                const pagePromises = [];
                for (let i = 0; i < certs.length; i++) {
                    const handleCertificateRecord = async (cert, index) => {
                        var _a;
                        if (!cert[5])
                            return;
                        try {
                            // needed information are already requested if the DNS names count <= 1
                            const { details } = cert[6] > 1
                                ? parseGoogleDetailsResponse(await axios_1.default.get(GcertApp.GOOGLE_BASE_URL + "/certbyhash", {
                                    params: {
                                        hash: cert[5],
                                    },
                                }))
                                : {
                                    details: [
                                        undefined,
                                        undefined,
                                        undefined,
                                        cert[3],
                                        undefined,
                                        undefined,
                                        undefined,
                                        [psl_1.default.get(cert[1])],
                                    ],
                                };
                            const dnsNamesWithDomain = [];
                            const domains = new Set();
                            for (const dnsName of details[7]) {
                                if (!dnsName)
                                    continue;
                                const domain = (_a = psl_1.default.get(dnsName)) === null || _a === void 0 ? void 0 : _a.toLowerCase();
                                if (!domain)
                                    continue;
                                domains.add(domain);
                                dnsNamesWithDomain.push({
                                    domain,
                                    dnsName,
                                });
                            }
                            for (const { domain, dnsName } of dnsNamesWithDomain) {
                                const item = new gcert_item_1.GcertItem({
                                    dnsName,
                                    domain,
                                    queriedDomain: target,
                                    issuanceDate: new Date(details[3]),
                                    domains,
                                }, this);
                                const [ipAddr, httpStatus] = this.options.resolve
                                    ? await Promise.all([item.resolve(), item.getHttpStatus()])
                                    : [undefined, undefined];
                                if (this.options.onlyResolved && !ipAddr) {
                                    continue;
                                }
                                const { resolvedIpAddress } = item;
                                const currentMultiplier = (value) => {
                                    return certs.length === 10
                                        ? 10 * value
                                        : 10 * (value - 1) + certs.length;
                                };
                                let color = resolvedIpAddress ? utils_1.Color.FgYellow : utils_1.Color.FgWhite;
                                color = httpStatus === 200 ? utils_1.Color.FgGreen : color;
                                (0, utils_1.log)(`${target} - ${index + 1 + currentMultiplier(currentPage - 1)}/${currentMultiplier(pageCount)} - ${dnsName} - ${resolvedIpAddress ? resolvedIpAddress : "not resolved"}`, color);
                                this.items.push(item);
                            }
                        }
                        catch (err) {
                            return;
                        }
                    };
                    pagePromises.push(handleCertificateRecord(certs[i], i));
                }
                await Promise.all(pagePromises);
                nextPage = footer[1];
            }
            catch (err) {
                if (previousPage === nextPage)
                    break;
            }
        } while (nextPage);
        if (depthLevel !== maxDepthLevel) {
            const domainPromises = [];
            const todoDomains = [...this.todoDomains];
            for (const domain of todoDomains) {
                if (this.doneDomains.has(domain))
                    continue;
                domainPromises.push(this.getCertificateRecords(domain, depthLevel + 1));
                this.doneDomains.add(domain);
                this.todoDomains.delete(domain);
            }
            await Promise.all(domainPromises);
        }
    }
    outputCertificateReports() {
        if (this.options.outputFormat === OutputFormat.none) {
            return;
        }
        (0, utils_1.log)(`Outputting ${this.options.outputFormat} report to stdout.`, utils_1.Color.FgCyan);
        switch (this.options.outputFormat) {
            case OutputFormat.json:
                (0, utils_1.output)(JSON.stringify(this.items));
                break;
            case OutputFormat.csv:
                const columns = [
                    {
                        key: "queriedDomain",
                        header: "Queried domain",
                    },
                    {
                        key: "linkedDomains",
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
                (0, utils_1.output)((0, sync_1.default)(this.items, {
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
                return (0, utils_1.output)((0, pug_1.renderFile)((0, path_1.join)(process.cwd(), "assets", "pug", "graph.pug"), {
                    title: `Report for ${this.options.initialTarget}`,
                    baseChartData: JSON.stringify(this.items.map((item) => ({
                        ...item,
                        date: item.lastIssuanceDate
                            ? item.lastIssuanceDate.toISOString()
                            : null,
                        linkedDomains: [...item.linkedDomains.values()],
                    }))),
                    chartModes: {
                        domains: [{ name: "Links between domains", value: "links" }],
                        ips: [],
                        wordcloud: [
                            { name: "Links between words", value: "links" },
                            { name: "Show domains", value: "domains" },
                            {
                                name: "Words only",
                                value: "only-words",
                                changeChartOptions: true,
                                chartOption: "onlyWords",
                            },
                        ],
                    },
                    globalOptions: [{ name: "Only resolved", value: "only-resolved" }],
                    command: process.argv.splice(2).join(" "),
                }));
            default:
                break;
        }
    }
}
exports.GcertApp = GcertApp;
GcertApp.HEADER = "\n\
  __ _  ___ ___ _ __| |_ \n\
 / _` |/ __/ _ \\ '__| __|\n\
| (_| | (_|  __/ |  | |_ \n\
 \\__, |\\___\\___|_|   \\__|\n\
 |___/";
GcertApp.VERSION = pkg.version;
GcertApp.DEFAULT_DEPTH_LEVEL = 0;
GcertApp.DEFAULT_OUTPUT_FORMAT = OutputFormat.html;
GcertApp.GOOGLE_BASE_URL = "https://transparencyreport.google.com/transparencyreport/api/v3/httpsreport/ct";
//# sourceMappingURL=gcert-app.js.map