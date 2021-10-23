"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateReport = void 0;
const tslib_1 = require("tslib");
const axios_1 = (0, tslib_1.__importDefault)(require("axios"));
const promises_1 = (0, tslib_1.__importDefault)(require("dns/promises"));
const utils_1 = require("../utils");
class CertificateReport {
    constructor(data, app, queriedDomain) {
        this.httpStatus = null;
        this.resolvedIpAddress = null;
        if (!data[1] || !data[3]) {
            throw new Error("Missing common name or timestamp index in certificate data array");
        }
        const commonName = data[1].toLowerCase();
        const timestamp = data[3];
        if (commonName.split(" ").length > 1) {
            throw new Error("Common name with whitespace");
        }
        if (CertificateReport.commonNames.has(commonName)) {
            // update already found report timestamp
            const certificateReport = app.certificateReports.find((c) => c.commonName === commonName);
            if (certificateReport && certificateReport.date < timestamp) {
                certificateReport.date = new Date(timestamp);
            }
            throw new Error("Common name already done");
        }
        CertificateReport.commonNames.add(commonName);
        const splittedCN = commonName.split(".");
        const domain = splittedCN.slice(-2).join(".");
        if (!app.todoDomains.includes(domain) &&
            !app.doneDomains.includes(domain) &&
            !app.options.denyList.includes(domain)) {
            (0, utils_1.log)("New domain found : " + domain, utils_1.Color.FgBlue);
            app.todoDomains.push(domain);
        }
        this.commonName = commonName;
        this.queriedDomain = queriedDomain;
        this.domain = domain;
        this.date = new Date(timestamp);
    }
    async getHttpStatus() {
        try {
            if (!this.commonName)
                return;
            const response = await axios_1.default.get("http://" + this.commonName);
            this.httpStatus = response.status;
            return this.httpStatus;
        }
        catch (err) { }
    }
    async resolve() {
        try {
            if (!this.commonName)
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