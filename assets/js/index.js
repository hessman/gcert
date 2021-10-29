let PER_DOMAIN = null;
let PER_IP = null;
let WORDCLOUD = null;
let CHART_DATA_UNFILTERED = null;
let CHART_DATA_MODE = null;

let FILTER_START_DATE = null;
let FILTER_END_DATE = null;
let FILTER_ONLY_RESOLVED = false;
let FILTER_WITH_LINKS = true;
let FILTER_WITH_DOMAINS = true;

function setupChartDatas() {
  if (PER_DOMAIN && PER_IP && WORDCLOUD) {
    return;
  }

  const addedDomains = new Map();
  const addedIps = new Map();
  const addedWords = new Map();
  const perDomainData = [];
  const perIpData = [];
  const wordcloudData = {
    base: [],
    onlyWords: [],
  };

  const getDomainIndex = (domain) => {
    let domainIndex = addedDomains.get(domain);
    if (domainIndex === undefined) {
      const payload = {
        id: "domain-" + domain,
        name: domain,
        value: 40,
      };
      const index =
        perDomainData.push({ ...payload, linkWith: [], children: [] }) - 1;
      addedDomains.set(domain, index);
      domainIndex = index;
    }
    return domainIndex;
  };

  for (const gcertItem of baseChartData) {
    const currentDomainIndex = getDomainIndex(gcertItem.domain);
    const linkWith = ["domain-" + gcertItem.queriedDomain];
    for (const d of [...gcertItem.linkedDomains]) {
      const domainIndex = getDomainIndex(d);
      perDomainData[domainIndex].value =
        (perDomainData[domainIndex].value || 0) + 1;
      linkWith.push();
    }
    const curentDomainNewValue =
      (perDomainData[currentDomainIndex].value || 0) + 1;

    perDomainData[currentDomainIndex].value = curentDomainNewValue;
    perDomainData[currentDomainIndex].children.push({
      id: "dnsName-" + gcertItem.dnsName,
      name: gcertItem.dnsName,
      value: 25,
      httpStatus: gcertItem.httpStatus,
      resolvedIpAddress: gcertItem.resolvedIpAddress,
      lastIssuanceDate: gcertItem.date ? new Date(gcertItem.date) : null,
      linkWith,
    });

    if (gcertItem.resolvedIpAddress) {
      let ipIndex = addedIps.get(gcertItem.resolvedIpAddress);
      if (ipIndex === undefined) {
        const index =
          perIpData.push({
            id: "ip-" + gcertItem.resolvedIpAddress,
            name: gcertItem.resolvedIpAddress,
            value: 40,
            linkWith: [],
            children: [],
          }) - 1;
        addedIps.set(gcertItem.resolvedIpAddress, index);
        ipIndex = index;
      }
      perIpData[ipIndex].value = (perIpData[ipIndex].value || 0) + 1;
      perIpData[ipIndex].children.push({
        id: "dnsName-" + gcertItem.dnsName,
        name: gcertItem.dnsName,
        value: 25,
        linkWith: [],
        httpStatus: gcertItem.httpStatus,
        resolvedIpAddress: gcertItem.resolvedIpAddress,
        lastIssuanceDate: gcertItem.date ? new Date(gcertItem.date) : null,
      });
    }

    const getWordIndex = (word) => {
      let wordIndex = addedWords.get(word);
      if (wordIndex === undefined) {
        const payload = {
          id: "word-" + word,
          name: word,
          value: 20,
        };
        const index =
          wordcloudData.base.push({
            ...payload,
            linkWith: [],
            children: [],
          }) - 1;

        wordcloudData.onlyWords.push({
          ...payload,
          linkWith: [],
          children: [],
        });
        addedWords.set(word, index);
        wordIndex = index;
      }
      return wordIndex;
    };

    const addWordEntry = (word, list, wordList) => {
      let wordIndex = getWordIndex(word);

      const newValue = (list[wordIndex].value || 0) + 1;
      list[wordIndex].value = newValue;
      const wordLinks = [
        ...new Set([
          ...wordList.filter((w) => w !== word).map((w) => "word-" + w),
          ...list[wordIndex].linkWith,
        ]),
      ];
      list[wordIndex].linkWith = wordLinks;
      const wordcloudDnsNamePayload = {
        id: "dnsName-" + gcertItem.dnsName,
        name: gcertItem.dnsName,
        value: 15,
        httpStatus: gcertItem.httpStatus,
        resolvedIpAddress: gcertItem.resolvedIpAddress,
        lastIssuanceDate: gcertItem.date ? new Date(gcertItem.date) : null,
      };
      list[wordIndex].children.push({
        ...wordcloudDnsNamePayload,
        linkWith: [],
      });
    };

    if (gcertItem.domain !== gcertItem.dnsName) {
      const dnsNameWithoutDomain = gcertItem.dnsName.replace(
        "." + gcertItem.domain,
        ""
      );
      if (dnsNameWithoutDomain) {
        addWordEntry(dnsNameWithoutDomain, wordcloudData.base, []);
        const splittedWord = dnsNameWithoutDomain.split(/[^a-zA-Z0-9]/g);
        for (const subword of splittedWord) {
          addWordEntry(subword, wordcloudData.onlyWords, splittedWord);
        }
      }
    }
  }

  if (!PER_DOMAIN) {
    PER_DOMAIN = perDomainData;
  }
  if (!PER_IP) {
    PER_IP = perIpData;
  }
  if (!WORDCLOUD) {
    WORDCLOUD = wordcloudData;
  }
}

const circleLabelSize = 15;
const resolvedIpAddressLabelSize = 10;

let chart;
let networkSeries;
let nodeTemplate;

am4core.useTheme(am4themes_animated);
function createChart() {
  if (chart) {
    chart.dispose();
  }
  chart = am4core.create(
    "chartdiv",
    am4plugins_forceDirected.ForceDirectedTree
  );
  chart.zoomable = true;
  networkSeries = chart.series.push(
    new am4plugins_forceDirected.ForceDirectedSeries()
  );

  networkSeries.dataFields.linkWith = "linkWith";
  networkSeries.dataFields.name = "name";
  networkSeries.dataFields.id = "id";
  networkSeries.dataFields.value = "value";
  networkSeries.dataFields.children = "children";

  networkSeries.nodes.template.label.text = "{name}";

  nodeTemplate = networkSeries.nodes.template;
  nodeTemplate.tooltipText = "{name}";
  nodeTemplate.fillOpacity = 1;

  const linkTemplate = networkSeries.links.template;
  linkTemplate.states.create("hover");

  nodeTemplate.events.on("over", function (event) {
    const dataItem = event.target.dataItem;
    dataItem.childLinks.each(function (link) {
      link.isHover = true;
    });
  });

  nodeTemplate.events.on("out", function (event) {
    const dataItem = event.target.dataItem;
    dataItem.childLinks.each(function (link) {
      link.isHover = false;
    });
  });

  nodeTemplate.label.fontSize = circleLabelSize;
  nodeTemplate.label.hideOversized = true;
  nodeTemplate.label.truncate = true;
}

function getTooltipTemplateForDnsName(item, withIp = false) {
  const txt = ["[bold]DNS name:[/] {name}"];
  if (item.lastIssuanceDate) {
    txt.push(
      "[bold]Last issuance date:[/] " +
        getLastIssuanceDateString(item.lastIssuanceDate)
    );
  }
  if (withIp && item.resolvedIpAddress) {
    txt.push("[bold]IP:[/] " + item.resolvedIpAddress);
  }
  if (item.httpStatus) {
    txt.push("[bold]HTTP status:[/] " + item.httpStatus);
  }
  return txt.join("\n");
}

function getLastIssuanceDateString(lastIssuanceDate) {
  return (
    (lastIssuanceDate.getMonth() + 1).toString().padStart(2, "0") +
    "/" +
    lastIssuanceDate.getDate().toString().padStart(2, "0") +
    "/" +
    lastIssuanceDate.getFullYear() +
    " " +
    lastIssuanceDate.getHours().toString().padStart(2, "0") +
    ":" +
    lastIssuanceDate.getMinutes().toString().padStart(2, "0") +
    ":" +
    lastIssuanceDate.getSeconds().toString().padStart(2, "0") +
    " UTC"
  );
}

function setupChart(options) {
  if (!["domains", "ips", "wordcloud"].includes(options.mode)) {
    return;
  }
  createChart();
  setupChartDatas();

  const isDomainChart = options.mode === "domains";
  const isIpsChart = options.mode === "ips";

  const tooltipGetter = (mode, target) => {
    if (target.dataItem.dataContext.lastIssuanceDate) {
      if (Array.isArray(target.dataItem.dataContext.lastIssuanceDate)) {
        return (
          (FILTER_ONLY_RESOLVED
            ? target.dataItem.dataContext.resolvedIpAddress.length
            : target.dataItem.dataContext.lastIssuanceDate.length) +
          " occurrences"
        );
      }
      return getTooltipTemplateForDnsName(
        target.dataItem.dataContext,
        isDomainChart
      );
    } else {
      if (mode === "wordcloud") {
        let count;
        if (FILTER_ONLY_RESOLVED) {
          count = FILTER_WITH_DOMAINS
            ? target.dataItem.dataContext.children.filter(
                (c) => !!c.resolvedIpAddress
              ).length
            : target.dataItem.dataContext.children[0].resolvedIpAddress.length;
        } else {
          count = FILTER_WITH_DOMAINS
            ? target.dataItem.dataContext.children.length
            : target.dataItem.dataContext.children[0].lastIssuanceDate.length;
        }
        return "[bold]Word:[/] {name}\n[bold]Occurrences:[/] " + count;
      }
      return isDomainChart ? "[bold]Domain:[/] {name}" : "[bold]IP:[/] {name}";
    }
  };
  switch (options.mode) {
    case "domains":
      chart.data = PER_DOMAIN;
      break;
    case "ips":
      chart.data = PER_IP;
      break;
    case "wordcloud":
      chart.data = options.onlyWords ? WORDCLOUD.onlyWords : WORDCLOUD.base;

      nodeTemplate.scale = 0.4;
      networkSeries.links.template.distance = 1;
      break;
  }

  CHART_DATA_UNFILTERED = chart.data;
  CHART_DATA_MODE = options.mode;
  setChartDataWithFilters();

  nodeTemplate.adapter.add("tooltipText", function (text, target, key) {
    return tooltipGetter(options.mode, target);
  });

  if (options.mode === "wordcloud" && !FILTER_WITH_DOMAINS) {
    nodeTemplate.label.adapter.add("text", function (text, target, key) {
      if (
        !target.parent.dataItem.dataContext.name.includes("{count-occurrences}")
      )
        return text;
      return target.parent.dataItem.dataContext.name.replace(
        "{count-occurrences}",
        FILTER_ONLY_RESOLVED
          ? target.parent.dataItem.dataContext.resolvedIpAddress.length
          : target.parent.dataItem.dataContext.lastIssuanceDate.length
      );
    });
  }

  if (options.mode !== "wordcloud") {
    nodeTemplate.circle.events.on("ready", function (event) {
      if (event.target.parent.children.length > 3) return;
      const dataContext = event.target.parent.dataItem.dataContext;
      if (
        (isDomainChart && !dataContext.resolvedIpAddress) ||
        (isIpsChart && !dataContext.httpStatus)
      ) {
        return;
      }

      let radius = event.target.pixelRadius;
      const ds = event.target.defaultState;
      const dsRadius = ds.properties.radius;
      if (typeof dsRadius === "number") {
        radius = dsRadius;
      }
      const baseSize = 2 * radius;

      const height = Math.max(Math.min(baseSize * 0.15, 20), 15);
      const width = Math.min(
        Math.round(baseSize * 0.99),
        isDomainChart ? 100 : 30
      );

      const httpStatusElem = event.target.parent.createChild(
        am4core.RoundedRectangle
      );
      httpStatusElem.dummyData = "extra-rectangle";
      httpStatusElem.fill =
        dataContext.httpStatus === 200 ? "#9ACD32" : "#DCDCDC";
      httpStatusElem.horizontalCenter = "middle";
      httpStatusElem.verticalCenter = "middle";
      httpStatusElem.y = baseSize / 2;
      httpStatusElem.x = am4core.percent(50);
      httpStatusElem.height = height;
      httpStatusElem.width = width;

      const label = event.target.parent.createChild(am4core.Label);
      label.dummyData = "extra-label";
      label.shouldClone = false;
      label.horizontalCenter = "middle";
      label.verticalCenter = "middle";
      label.strokeOpacity = 0;
      label.interactionsEnabled = false;
      label.textAlign = "middle";
      label.textValign = "middle";
      label.nonScaling = true;
      label.y = baseSize / 2;
      label.x = am4core.percent(50);
      label.height = height;
      label.width = width;
      if (isDomainChart) {
        label.text = "";

        if (dataContext.resolvedIpAddress) {
          label.text += dataContext.resolvedIpAddress + " ";
        }
        if (dataContext.httpStatus) {
          label.text += "(" + dataContext.httpStatus + ")";
        }
      } else {
        label.text = dataContext.httpStatus;
      }
      label.fontWeight = "bold";
      label.fontSize = resolvedIpAddressLabelSize;

      label.hideOversized = true;
      label.truncate = true;
    });

    nodeTemplate.events.on("sizechanged", function (ev) {
      const label = ev.target.children.values.find(
        (c) => c.dummyData === "extra-label"
      );
      const rect = ev.target.children.values.find(
        (c) => c.dummyData === "extra-rectangle"
      );
      if (!label) return;

      let scale = 1;

      if (ev.target.parent && ev.target.parent.parent) {
        scale = ev.target.parent.parent.scale;
      }

      label.width = rect.pixelWidth * scale;
      label.height = rect.pixelHeight * scale;
    });
  }
}

function filterChartDataOn(event) {
  const id = event.target.id;

  if (["start", "end"].includes(id)) {
    const date = new Date(event.target.value);
    if (typeof date.getTime() !== "number" || isNaN(date.getTime())) {
      if (id === "start") {
        FILTER_START_DATE = null;
      } else {
        FILTER_END_DATE = null;
      }
    } else {
      if (id === "start") {
        FILTER_START_DATE = date;
      } else {
        FILTER_END_DATE = date;
      }
    }
  } else if (id === "global-only-resolved") {
    FILTER_ONLY_RESOLVED = !!event.target.checked;
  } else if (["domains-links", "wordcloud-links"].includes(id)) {
    FILTER_WITH_LINKS = !!event.target.checked;
  } else if (id === "wordcloud-domains") {
    FILTER_WITH_DOMAINS = !!event.target.checked;
  }

  console.log(FILTER_START_DATE);
  console.log(FILTER_END_DATE);

  setChartDataWithFilters();
}

function setChartDataWithFilters() {
  chart.data = CHART_DATA_UNFILTERED.map((item) => {
    const children = item.children.filter((subitem) => {
      if (
        FILTER_ONLY_RESOLVED &&
        (!subitem.resolvedIpAddress ||
          (Array.isArray(subitem.resolvedIpAddress) &&
            !subitem.resolvedIpAddress.length))
      )
        return false;

      if (!FILTER_START_DATE && !FILTER_END_DATE) return true;

      if (Array.isArray(subitem.lastIssuanceDate)) {
        for (const issuanceDate of subitem.lastIssuanceDate) {
          if (
            (!FILTER_START_DATE || FILTER_START_DATE <= issuanceDate) &&
            (!FILTER_END_DATE || FILTER_END_DATE >= issuanceDate)
          ) {
            return true;
          }
        }
      } else {
        return (
          (!FILTER_START_DATE ||
            FILTER_START_DATE <= subitem.lastIssuanceDate) &&
          (!FILTER_END_DATE || FILTER_END_DATE >= subitem.lastIssuanceDate)
        );
      }

      return false;
    });
    if (CHART_DATA_MODE === "wordcloud") {
      const lastIssuanceDate = [];
      const resolvedIpAddress = [];
      const finalChildren = [];
      for (const child of children) {
        if (child.lastIssuanceDate) {
          lastIssuanceDate.push(child.lastIssuanceDate);
        }
        if (child.resolvedIpAddress) {
          resolvedIpAddress.push(child.resolvedIpAddress);
        }
        finalChildren.push(
          !FILTER_WITH_LINKS ? { ...child, linkWith: [] } : child
        );
      }
      return {
        ...item,
        linkWith: FILTER_WITH_LINKS ? item.linkWith : [],

        children:
          CHART_DATA_MODE === "wordcloud" && !FILTER_WITH_DOMAINS
            ? [
                {
                  id: "count-" + item.name,
                  name: "{count-occurrences}",
                  value: 15,
                  linkWith: [],
                  lastIssuanceDate: lastIssuanceDate,
                  resolvedIpAddress: resolvedIpAddress,
                },
              ]
            : finalChildren,
      };
    }
    return {
      ...item,
      linkWith:
        CHART_DATA_MODE !== "ips" && !FILTER_WITH_LINKS ? [] : item.linkWith,
      children: children.map((c) =>
        CHART_DATA_MODE !== "ips" && !FILTER_WITH_LINKS
          ? {
              ...c,
              linkWith: [],
            }
          : c
      ),
    };
  }).filter((item) => !!item.children.length);
}

function toggleChoicesVisibility(prefix) {
  for (const el of document.querySelectorAll("li[id$='-choices']")) {
    if (el.id.startsWith("global")) {
      continue;
    }
    el.style.display = "none";
  }
  const currentEl = document.getElementById(prefix + "-choices");
  if (!currentEl) return;
  currentEl.style.display = "list-item";
}

function checkChoice(mode, option) {
  const el = document.getElementById(mode + "-" + option);
  if (!el) return;
  el.checked = true;
}

var chartMode = "domains";
var chartOptions = null;

function changeChartMode(mode, options) {
  if (!["domains", "ips", "wordcloud"].includes(mode)) return;
  chartMode = mode;
  if (mode !== chartMode) {
    chartOptions = null;
    if (mode === "wordcloud") {
      filterChartDataOn({ target: { checked: true, id: "wordcloud-links" } });
    }
  }
  switch (chartMode) {
    case "domains":
      chartOptions = options ? options : {};
      toggleChoicesVisibility("domains");
      checkChoice("domains", "links");
      setupChart({ ...chartOptions, mode: "domains" });
      break;
    case "ips":
      chartOptions = options ? options : {};
      toggleChoicesVisibility("ips");
      setupChart({ ...chartOptions, mode: "ips" });
      break;
    case "wordcloud":
      chartOptions = options ? options : { onlyWords: true };
      toggleChoicesVisibility("wordcloud");
      checkChoice("wordcloud", "links");
      if (chartOptions.onlyWords) {
        checkChoice("wordcloud", "only-words");
      }
      setupChart({ ...chartOptions, mode: "wordcloud" });
      break;
  }
}

function changeChartOptions(options) {
  const opts = { ...(chartOptions ? chartOptions : {}), ...options };
  changeChartMode(chartMode, opts);
}

changeChartMode("domains");
