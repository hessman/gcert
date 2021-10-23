import axios, { AxiosResponse } from "axios";
import { Command, Option } from "commander";
import { CertificateReport } from "./certificate-report";

export interface GsubOptions {
  maxDepthLevel: number;
  outputFormat: OutputFormat;
  onlyResolved: boolean;
  denyList: string[];
  initialTarget: string;
}

export enum OutputFormat {
  json = "json",
  csv = "csv",
  html = "html",
}

export class GsubApp {
  static readonly DEFAULT_DEPTH_LEVEL = 0;
  static readonly DEFAULT_OUTPUT_FORMAT = OutputFormat.html;
  static readonly GOOGLE_BASE_URL =
    "https://transparencyreport.google.com/transparencyreport/api/v3/httpsreport/ct/certsearch";

  public certificateReports: CertificateReport[] = [];
  public todoDomains: string[] = [];
  public doneDomains: string[] = [];

  public options: GsubOptions = {
    maxDepthLevel: 0,
    outputFormat: OutputFormat.html,
    onlyResolved: false,
    denyList: [],
    initialTarget: "",
  };

  constructor() {
    const program = new Command();
    program
      .name("gsub")
      .usage("-t domain.tld -d google.com google.fr -o json > report.json")
      .description(
        "Tool to retrieve SSL/TLS certificate reports information from the Google Transparency Report for a given domain."
      )
      .version("0.1.0", "-v, --version", "output the current version")
      .requiredOption("-t, --target [domain]", "set the target domain")
      .addOption(
        new Option(
          "-l, --depth-level <level>",
          "set the depth level for the recursive domain discovery"
        ).default("0")
      )
      .addOption(
        new Option(
          "-o, --output-format",
          "set the format for the report sent to stdout"
        )
          .choices([OutputFormat.csv, OutputFormat.html, OutputFormat.json])
          .default("html")
      )
      .addOption(
        new Option("-r, --only-resolved", "only output resolved domain")
      )
      .addOption(
        new Option(
          "-d, --deny-list [domain...]",
          "set the deny list for domain"
        )
      )
      .parse();

    const opts = program.opts();

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

  async getCNRecords(
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

    console.error(
      "\x1b[33m" + "Checking CN records for domain : " + target + "\x1b[0m"
    );
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
        for (const cert of certs) {
          try {
            const certificateReport = new CertificateReport(cert, this, target);
            const [ipAddr, httpStatus] = await Promise.all([
              certificateReport.resolve(),
              certificateReport.getHttpStatus(),
            ]);
            if (this.options.onlyResolved && !ipAddr) {
              continue;
            }
            const result = `${certificateReport.domain} - ${certificateReport.CN} - ${certificateReport.status} - ${certificateReport.ipAddr}`;
            if (httpStatus === 200) {
              console.error("\x1b[32m" + result + "\x1b[0m");
            } else {
              console.error(result);
            }
            this.certificateReports.push(certificateReport);
          } catch (err) {
            continue;
          }
        }
        nextPage = footer[1];
      } catch (err) {
        if (!nextPage) {
          console.error(`Invalid domain ${target}, skipping...`);
        }
      }
    } while (nextPage);

    if (depthLevel !== maxDepthLevel) {
      const ops = [];
      for (const domain of this.todoDomains) {
        ops.push(this.getCNRecords(domain, depthLevel + 1));
      }
      await Promise.all(ops);
    }
  }

  outputCertificateReports() {
    switch (this.options.outputFormat) {
      case OutputFormat.json:
        return console.log(JSON.stringify(this.certificateReports));
      case OutputFormat.csv:
        return console.log(JSON.stringify(this.certificateReports));
      case OutputFormat.html:
        return console.log(JSON.stringify(this.certificateReports));
      default:
        break;
    }
  }
}
