"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateReport = void 0;
const tslib_1 = require("tslib");
const axios_1 = (0, tslib_1.__importDefault)(require("axios"));
const promises_1 = (0, tslib_1.__importDefault)(require("dns/promises"));
class CertificateReport {
    constructor(data, app, fromDomain = null) {
        this.domain = null;
        this.CN = null;
        this.status = null;
        this.ipAddr = null;
        this.fromDomain = null;
        if (!data[1]) {
            throw new Error("Missing CN index in certificate data array");
        }
        const CN = data[1].toLowerCase();
        if (CN.split(" ").length > 1) {
            throw new Error("CN with whitespace");
        }
        if (CertificateReport.commonNames.has(CN)) {
            throw new Error("CN already done");
        }
        CertificateReport.commonNames.add(CN);
        const splittedCN = CN.split(".");
        const domain = splittedCN.slice(-2).join(".");
        if (!app.todoDomains.includes(domain) &&
            !app.doneDomains.includes(domain) &&
            !app.options.denyList.includes(domain)) {
            console.error("\x1b[34m" + "New domain found : " + domain + "\x1b[0m");
            app.todoDomains.push(domain);
        }
        this.CN = CN;
        this.fromDomain = fromDomain;
        this.domain = domain;
    }
    async getHttpStatus() {
        try {
            if (!this.CN)
                return;
            const response = await axios_1.default.get("http://" + this.CN);
            this.status = response.status;
            return this.status;
        }
        catch (err) { }
    }
    async resolve() {
        try {
            if (!this.CN)
                return;
            const response = await promises_1.default.lookup(this.CN);
            this.ipAddr = response.address;
            return this.ipAddr;
        }
        catch (err) { }
    }
}
exports.CertificateReport = CertificateReport;
CertificateReport.commonNames = new Set();
//# sourceMappingURL=certificate-report.js.map