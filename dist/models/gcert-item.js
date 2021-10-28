"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GcertItem = void 0;
const tslib_1 = require("tslib");
const axios_1 = (0, tslib_1.__importDefault)(require("axios"));
const promises_1 = (0, tslib_1.__importDefault)(require("dns/promises"));
const utils_1 = require("../utils");
class GcertItem {
    constructor(payload, app) {
        const { dnsName, domains, queriedDomain, issuanceDate, domain } = payload;
        if (dnsName.split(" ").length > 1) {
            throw new Error("DNS name with whitespace");
        }
        if (GcertItem.dnsNames.has(dnsName)) {
            // update already found report last issuance date
            const gcertItem = app.items.find((r) => r.dnsName === dnsName);
            if (!gcertItem) {
                throw new Error("DNS name already done but not found");
            }
            if (gcertItem && gcertItem.lastIssuanceDate < issuanceDate) {
                gcertItem.lastIssuanceDate = issuanceDate;
            }
            for (const d of payload.domains) {
                gcertItem.linkedDomains.add(d);
            }
            throw new Error("DNS name already done");
        }
        GcertItem.dnsNames.add(dnsName);
        if (app.options.denyList.includes(domain)) {
            throw new Error("Domain on deny list");
        }
        if (!app.todoDomains.has(domain) &&
            !app.doneDomains.has(domain) &&
            !app.options.denyList.includes(domain)) {
            (0, utils_1.log)("New domain found : " + domain, utils_1.Color.FgBlue);
            app.todoDomains.add(domain);
        }
        this.domain = domain;
        this.dnsName = dnsName;
        this.queriedDomain = queriedDomain;
        this.linkedDomains = domains;
        this.lastIssuanceDate = issuanceDate;
    }
    async getHttpStatus() {
        var _a;
        try {
            if (this.dnsName.includes("*"))
                return;
            const op = async (protocol) => {
                try {
                    return await axios_1.default.get(`${protocol}://${this.dnsName}`, {
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
            if (this.dnsName.includes("*"))
                return;
            const response = await promises_1.default.lookup(this.dnsName);
            this.resolvedIpAddress = response.address;
            return this.resolvedIpAddress;
        }
        catch (err) { }
    }
}
exports.GcertItem = GcertItem;
GcertItem.dnsNames = new Set();
//# sourceMappingURL=gcert-item.js.map