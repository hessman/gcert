"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateReport = void 0;
const tslib_1 = require("tslib");
const axios_1 = (0, tslib_1.__importDefault)(require("axios"));
const promises_1 = (0, tslib_1.__importDefault)(require("dns/promises"));
const utils_1 = require("../utils");
class CertificateReport {
    constructor(data, app, queriedDomain) {
        if (!data[1] || !data[3]) {
            throw new Error("Missing common name or timestamp index in certificate data array");
        }
        const commonName = data[1].toLowerCase();
        const timestamp = data[3];
        if (commonName.split(" ").length > 1) {
            throw new Error("Common name with whitespace");
        }
        if (CertificateReport.commonNames.has(commonName)) {
            // update already found report last issuance date
            const certificateReport = app.certificateReports.find((c) => c.commonName === commonName);
            if (certificateReport && certificateReport.lastIssuanceDate < timestamp) {
                certificateReport.lastIssuanceDate = new Date(timestamp);
            }
            throw new Error("Common name already done");
        }
        CertificateReport.commonNames.add(commonName);
        const splittedCN = commonName.split(".");
        const domain = splittedCN.slice(-2).join(".");
        if (app.options.denyList.includes(domain)) {
            throw new Error("Domain on deny list");
        }
        if (!app.todoDomains.has(domain) &&
            !app.doneDomains.has(domain) &&
            !app.options.denyList.includes(domain)) {
            (0, utils_1.log)("New domain found : " + domain, utils_1.Color.FgBlue);
            app.todoDomains.add(domain);
        }
        this.commonName = commonName;
        this.queriedDomain = queriedDomain;
        this.domain = domain;
        this.lastIssuanceDate = new Date(timestamp);
    }
    async getHttpStatus() {
        var _a;
        try {
            if (this.commonName.includes("*"))
                return;
            const op = async (protocol) => {
                try {
                    return await axios_1.default.get(`${protocol}://${this.commonName}`, {
                        timeout: 5000,
                    });
                }
                catch (err) {
                    return undefined;
                }
            };
            const [httpResponse, httpsResponse] = await Promise.all([
                op("http"),
                op("https"),
            ]);
            this.httpStatus = (_a = httpsResponse === null || httpsResponse === void 0 ? void 0 : httpsResponse.status) !== null && _a !== void 0 ? _a : httpResponse === null || httpResponse === void 0 ? void 0 : httpResponse.status;
            return this.httpStatus;
        }
        catch (err) { }
    }
    async resolve() {
        try {
            if (this.commonName.includes("*"))
                return;
            const response = await promises_1.default.lookup(this.commonName);
            this.resolvedIpAddress = response.address;
            return this.resolvedIpAddress;
        }
        catch (err) { }
    }
}
exports.CertificateReport = CertificateReport;
CertificateReport.commonNames = new Set();
//# sourceMappingURL=certificate-report.js.map