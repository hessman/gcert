function getCertificateReportsGroupedPerIp() {
  const addedIps = new Map();
  const data = [];

  for (const certificateReport of baseChartData) {
    if (!certificateReport.resolvedIpAddress) continue;
    let ipIndex = addedIps.get(certificateReport.resolvedIpAddress);
    if (ipIndex === undefined) {
      const index =
        data.push({
          id: 'ip-' + certificateReport.resolvedIpAddress,
          name: certificateReport.resolvedIpAddress,
          value: 40,
          linkWith: [],
          children: [],
        }) - 1;
      addedIps.set(certificateReport.resolvedIpAddress, index);
      ipIndex = index;
    }
    data[ipIndex].value = (data[ipIndex].value ?? 0) + 1;
    data[ipIndex].children.push({
      id: 'cn-' + certificateReport.commonName,
      name: certificateReport.commonName,
      value: 25,
      linkWith: [],
      httpStatus: certificateReport.httpStatus,
      resolvedIpAddress: certificateReport.resolvedIpAddress,
      lastIssuanceDate: certificateReport.date
        ? new Date(certificateReport.date)
        : null,
    });
  }
  return data;
}

function getCertificateReportsWordcloud(options) {
  const addedWords = new Map();
  const data = [];

  for (const certificateReport of baseChartData) {
    const commonNameSplitted = [
      ...new Set(certificateReport.commonName.split('.').slice(0, -2)),
    ];
    if (!commonNameSplitted.length) continue;
    for (const word of commonNameSplitted) {
      let wordIndex = addedWords.get(word);
      if (wordIndex === undefined) {
        const index =
          data.push({
            id: 'word-' + word,
            name: word,
            value: 20,
            linkWith: [],
            children: [],
          }) - 1;
        addedWords.set(word, index);
        wordIndex = index;
      }
      data[wordIndex].value = (data[wordIndex].value ?? 0) + 1;
      if (options.links) {
        data[wordIndex].linkWith = [
          ...new Set([
            ...commonNameSplitted
              .filter((w) => w !== word)
              .map((w) => 'word-' + w),
            ...data[wordIndex].linkWith,
          ]),
        ];
      }
      if (options.domains) {
        data[wordIndex].children.push({
          id: 'cn-' + certificateReport.commonName,
          name: certificateReport.commonName,
          value: 15,
          linkWith: [],
          httpStatus: certificateReport.httpStatus,
          resolvedIpAddress: certificateReport.resolvedIpAddress,
          lastIssuanceDate: certificateReport.date
            ? new Date(certificateReport.date)
            : null,
        });
      } else {
        if (data[wordIndex].children.length === 1) {
          data[wordIndex].children[0].count += 1;
          data[wordIndex].children[0].name =
            data[wordIndex].children[0].count.toString() + ' occurrences';
          data[wordIndex].children[0].lastIssuanceDate.push(
            certificateReport.lastIssuanceDate
          );
        } else {
          data[wordIndex].children.push({
            id: 'count-' + word,
            name: '1 occurrences',
            value: 15,
            linkWith: [],
            count: 1,
            lastIssuanceDate: [certificateReport.lastIssuanceDate],
          });
        }
      }
    }
  }
  return data;
}

let PER_DOMAIN = { links: null, base: null };
let PER_IP = null;
let CHART_DATA_UNFILTERED = null;
let WORDCLOUD = {
  base: { links: null, base: null },
  domains: { links: null, base: null },
};

let START_DATE = null;
let END_DATE = null;

function setupChartDatas() {
  const addedDomains = new Map();
  const addedIps = new Map();
  const addedWords = new Map();
  const perDomainData = { links: [], base: [] };
  const perIpData = [];
  const wordcloudData = {
    base: { links: [], base: [] },
    domains: { links: [], base: [] },
  };

  const getDomainIndex = (domain) => {
    let domainIndex = addedDomains.get(domain);
    if (domainIndex === undefined) {
      const payload = {
        id: 'domain-' + domain,
        name: domain,
        value: 40,
      };
      const index =
        perDomainData.base.push({ ...payload, linkWith: [], children: [] }) - 1;
      perDomainData.links.push({ ...payload, linkWith: [], children: [] });
      addedDomains.set(domain, index);
      domainIndex = index;
    }
    return domainIndex;
  };

  for (const certificateReport of baseChartData) {
    const domainIndex = getDomainIndex(certificateReport.queriedDomain);
    const currentDomainIndex = getDomainIndex(certificateReport.domain);
    const domainNewValue = (perDomainData.base[domainIndex].value ?? 0) + 1;
    const curentDomainNewValue =
      (perDomainData.base[currentDomainIndex].value ?? 0) + 1;
    perDomainData.base[domainIndex].value = domainNewValue;
    perDomainData.links[domainIndex].value = domainNewValue;
    perDomainData.base[currentDomainIndex].value = curentDomainNewValue;
    perDomainData.links[currentDomainIndex].value = curentDomainNewValue;
    const commonNamePayload = {
      id: 'cn-' + certificateReport.commonName,
      name: certificateReport.commonName,
      value: 25,
      linkWith: [],
      httpStatus: certificateReport.httpStatus,
      resolvedIpAddress: certificateReport.resolvedIpAddress,
      lastIssuanceDate: certificateReport.date
        ? new Date(certificateReport.date)
        : null,
    };
    perDomainData.base[currentDomainIndex].children.push(commonNamePayload);
    perDomainData.links[currentDomainIndex].children.push({
      ...commonNamePayload,
      linkWith: ['domain-' + certificateReport.queriedDomain],
    });

    if (certificateReport.resolvedIpAddress) {
      let ipIndex = addedIps.get(certificateReport.resolvedIpAddress);
      if (ipIndex === undefined) {
        const index =
          perIpData.push({
            id: 'ip-' + certificateReport.resolvedIpAddress,
            name: certificateReport.resolvedIpAddress,
            value: 40,
            linkWith: [],
            children: [],
          }) - 1;
        addedIps.set(certificateReport.resolvedIpAddress, index);
        ipIndex = index;
      }
      perIpData[ipIndex].value = (perIpData[ipIndex].value ?? 0) + 1;
      perIpData[ipIndex].children.push({
        id: 'cn-' + certificateReport.commonName,
        name: certificateReport.commonName,
        value: 25,
        linkWith: [],
        httpStatus: certificateReport.httpStatus,
        resolvedIpAddress: certificateReport.resolvedIpAddress,
        lastIssuanceDate: certificateReport.date
          ? new Date(certificateReport.date)
          : null,
      });
    }

    const commonNameSplitted = [
      ...new Set(certificateReport.commonName.split('.').slice(0, -2)),
    ];
    if (!!commonNameSplitted.length) {
      for (const word of commonNameSplitted) {
        let wordIndex = addedWords.get(word);
        if (wordIndex === undefined) {
          const payload = {
            id: 'word-' + word,
            name: word,
            value: 20,
          };
          const index =
            wordcloudData.base.base.push({
              ...payload,
              linkWith: [],
              children: [],
            }) - 1;
          wordcloudData.base.links.push({
            ...payload,
            linkWith: [],
            children: [],
          });
          wordcloudData.domains.base.push({
            ...payload,
            linkWith: [],
            children: [],
          });
          wordcloudData.domains.links.push({
            ...payload,
            linkWith: [],
            children: [],
          });
          addedWords.set(word, index);
          wordIndex = index;
        }
        const newValue = (wordcloudData.base.base[wordIndex].value ?? 0) + 1;
        wordcloudData.base.base[wordIndex].value = newValue;
        wordcloudData.base.links[wordIndex].value = newValue;
        wordcloudData.domains.base[wordIndex].value = newValue;
        wordcloudData.domains.links[wordIndex].value = newValue;
        const wordLinks = [
          ...new Set([
            ...commonNameSplitted
              .filter((w) => w !== word)
              .map((w) => 'word-' + w),
            ...wordcloudData.base.links[wordIndex].linkWith,
          ]),
        ];
        wordcloudData.base.links[wordIndex].linkWith = wordLinks;
        wordcloudData.domains.links[wordIndex].linkWith = wordLinks;
        const wordcloudCommonNamePayload = {
          id: 'cn-' + certificateReport.commonName,
          name: certificateReport.commonName,
          value: 15,
          httpStatus: certificateReport.httpStatus,
          resolvedIpAddress: certificateReport.resolvedIpAddress,
          lastIssuanceDate: certificateReport.date
            ? new Date(certificateReport.date)
            : null,
        };
        wordcloudData.domains.base[wordIndex].children.push({
          ...wordcloudCommonNamePayload,
          linkWith: [],
        });
        wordcloudData.domains.links[wordIndex].children.push({
          ...wordcloudCommonNamePayload,
          linkWith: [],
        });
        if (wordcloudData.base.base[wordIndex].children.length === 1) {
          wordcloudData.base.base[wordIndex].children[0].count += 1;
          wordcloudData.base.base[wordIndex].children[0].name =
            wordcloudData.base.base[wordIndex].children[0].count.toString() +
            ' occurrences';
          wordcloudData.base.links[wordIndex].children[0].count =
            wordcloudData.base.base[wordIndex].children[0].count;
          wordcloudData.base.links[wordIndex].children[0].name =
            wordcloudData.base.base[wordIndex].children[0].name;
          wordcloudData.base.base[wordIndex].children[0].lastIssuanceDate.push(
            certificateReport.lastIssuanceDate
          );
          wordcloudData.base.links[wordIndex].children[0].lastIssuanceDate.push(
            certificateReport.lastIssuanceDate
          );
        } else {
          const occurrencesPayload = {
            id: 'count-' + word,
            name: '1 occurrences',
            value: 15,
            count: 1,
          };
          wordcloudData.base.base[wordIndex].children.push({
            ...occurrencesPayload,
            linkWith: [],
            lastIssuanceDate: [certificateReport.lastIssuanceDate],
          });
          wordcloudData.base.links[wordIndex].children.push({
            ...occurrencesPayload,
            linkWith: [],
            lastIssuanceDate: [certificateReport.lastIssuanceDate],
          });
        }
      }
    }
  }

  if (!PER_DOMAIN.base) {
    PER_DOMAIN.base = perDomainData.base;
  }
  if (!PER_DOMAIN.links) {
    PER_DOMAIN.links = perDomainData.links;
  }
  if (!PER_IP) {
    PER_IP = perIpData;
  }
  if (!WORDCLOUD.base.base) {
    WORDCLOUD.base.base = wordcloudData.base.base;
  }
  if (!WORDCLOUD.base.links) {
    WORDCLOUD.base.links = wordcloudData.base.links;
  }
  if (!WORDCLOUD.domains.base) {
    WORDCLOUD.domains.base = wordcloudData.domains.base;
  }
  if (!WORDCLOUD.domains.links) {
    WORDCLOUD.domains.links = wordcloudData.domains.links;
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
    'chartdiv',
    am4plugins_forceDirected.ForceDirectedTree
  );
  chart.zoomable = true;
  networkSeries = chart.series.push(
    new am4plugins_forceDirected.ForceDirectedSeries()
  );

  networkSeries.dataFields.linkWith = 'linkWith';
  networkSeries.dataFields.name = 'name';
  networkSeries.dataFields.id = 'id';
  networkSeries.dataFields.value = 'value';
  networkSeries.dataFields.children = 'children';

  networkSeries.nodes.template.label.text = '{name}';

  nodeTemplate = networkSeries.nodes.template;
  nodeTemplate.tooltipText = '{name}';
  nodeTemplate.fillOpacity = 1;

  const linkTemplate = networkSeries.links.template;
  linkTemplate.states.create('hover');

  nodeTemplate.events.on('over', function (event) {
    const dataItem = event.target.dataItem;
    dataItem.childLinks.each(function (link) {
      link.isHover = true;
    });
  });

  nodeTemplate.events.on('out', function (event) {
    const dataItem = event.target.dataItem;
    dataItem.childLinks.each(function (link) {
      link.isHover = false;
    });
  });

  nodeTemplate.label.fontSize = circleLabelSize;
  nodeTemplate.label.hideOversized = true;
  nodeTemplate.label.truncate = true;
}

function getTooltipTemplateForCommonName(item, withIp = false) {
  const txt = ['[bold]CN:[/] {name}'];
  if (item.lastIssuanceDate) {
    txt.push(
      '[bold]Last issuance date:[/] ' +
        getLastIssuanceDateString(item.lastIssuanceDate)
    );
  }
  if (withIp && item.resolvedIpAddress) {
    txt.push('[bold]IP:[/] ' + item.resolvedIpAddress);
  }
  if (item.httpStatus) {
    txt.push('[bold]HTTP status:[/] ' + item.httpStatus);
  }
  return txt.join('\n');
}

function getLastIssuanceDateString(lastIssuanceDate) {
  return (
    (lastIssuanceDate.getMonth() + 1).toString().padStart(2, '0') +
    '/' +
    lastIssuanceDate.getDate().toString().padStart(2, '0') +
    '/' +
    lastIssuanceDate.getFullYear() +
    ' ' +
    lastIssuanceDate.getHours().toString().padStart(2, '0') +
    ':' +
    lastIssuanceDate.getMinutes().toString().padStart(2, '0') +
    ':' +
    lastIssuanceDate.getSeconds().toString().padStart(2, '0') +
    ' UTC'
  );
}

function setupChart(options) {
  if (!['domains', 'ips', 'wordcloud'].includes(options.mode)) {
    return;
  }
  createChart();
  setupChartDatas();

  const isDomainChart = options.mode === 'domains';
  const isIpsChart = options.mode === 'ips';

  const tooltipGetter = (mode, target) => {
    if (target.dataItem.dataContext.lastIssuanceDate) {
      if (Array.isArray(target.dataItem.dataContext.lastIssuanceDate)) {
        return '{name}';
      }
      return getTooltipTemplateForCommonName(
        target.dataItem.dataContext,
        isDomainChart
      );
    } else {
      if (mode === 'wordcloud') {
        return (
          '[bold]Word:[/] {name}\n[bold]Occurrences:[/] ' +
          (options.domains
            ? target.dataItem.dataContext.children.length
            : target.dataItem.dataContext.children[0].count)
        );
      }
      return isDomainChart ? '[bold]Domain:[/] {name}' : '[bold]IP:[/] {name}';
    }
  };
  switch (options.mode) {
    case 'domains':
      chart.data = options.links ? PER_DOMAIN.links : PER_DOMAIN.base;
      break;
    case 'ips':
      chart.data = PER_IP;
      break;
    case 'wordcloud':
      const key = options.links ? 'links' : 'base';
      chart.data = options.domains
        ? WORDCLOUD.domains[key]
        : WORDCLOUD.base[key];
      break;
  }

  CHART_DATA_UNFILTERED = chart.data;
  setChartDataWithFilters();

  nodeTemplate.adapter.add('tooltipText', function (text, target, key) {
    return tooltipGetter(options.mode, target);
  });

  if (options.mode !== 'wordcloud') {
    nodeTemplate.circle.events.on('ready', function (event) {
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
      if (typeof dsRadius === 'number') {
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
      httpStatusElem.dummyData = 'extra-rectangle';
      httpStatusElem.fill =
        dataContext.httpStatus === 200 ? '#9ACD32' : '#DCDCDC';
      httpStatusElem.horizontalCenter = 'middle';
      httpStatusElem.verticalCenter = 'middle';
      httpStatusElem.y = baseSize / 2;
      httpStatusElem.x = am4core.percent(50);
      httpStatusElem.height = height;
      httpStatusElem.width = width;

      const label = event.target.parent.createChild(am4core.Label);
      label.dummyData = 'extra-label';
      label.shouldClone = false;
      label.horizontalCenter = 'middle';
      label.verticalCenter = 'middle';
      label.strokeOpacity = 0;
      label.interactionsEnabled = false;
      label.textAlign = 'middle';
      label.textValign = 'middle';
      label.nonScaling = true;
      label.y = baseSize / 2;
      label.x = am4core.percent(50);
      label.height = height;
      label.width = width;
      if (isDomainChart) {
        label.text = '';

        if (dataContext.resolvedIpAddress) {
          label.text += dataContext.resolvedIpAddress + ' ';
        }
        if (dataContext.httpStatus) {
          label.text += '(' + dataContext.httpStatus + ')';
        }
      } else {
        label.text = dataContext.httpStatus;
      }
      label.fontWeight = 'bold';
      label.fontSize = resolvedIpAddressLabelSize;

      label.hideOversized = true;
      label.truncate = true;
    });

    nodeTemplate.events.on('sizechanged', function (ev) {
      const label = ev.target.children.values.find(
        (c) => c.dummyData === 'extra-label'
      );
      const rect = ev.target.children.values.find(
        (c) => c.dummyData === 'extra-rectangle'
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

function filterChartDataOnDate(event) {
  const id = event.target.id;
  const date = new Date(event.target.value);
  if (typeof date.getTime() !== 'number' || isNaN(date.getTime())) {
    if (id === 'start') {
      START_DATE = null;
    } else if (id === 'end') {
      END_DATE = null;
    }
  } else {
    if (id === 'start') {
      START_DATE = date;
    } else if (id === 'end') {
      END_DATE = date;
    }
  }

  setChartDataWithFilters();
}

function setChartDataWithFilters() {
  chart.data = CHART_DATA_UNFILTERED.map((item) => ({
    ...item,
    children: item.children.filter((subitem) => {
      if (!START_DATE && !END_DATE) return true;

      if (typeof subitem.lastIssuanceDate === 'string') {
        return (
          (!START_DATE || START_DATE <= subitem.lastIssuanceDate) &&
          (!END_DATE || END_DATE >= subitem.lastIssuanceDate)
        );
      }

      if (Array.isArray(subitem.lastIssuanceDate)) {
        for (const issuanceDate of subitem.lastIssuanceDate) {
          if (
            (!START_DATE || START_DATE <= issuanceDate) &&
            (!END_DATE || END_DATE >= issuanceDate)
          ) {
            return true;
          }
        }
      }

      return false;
    }),
  })).filter((item) => !!item.children.length);
}

function toggleChoicesVisibility(prefix, force) {
  const el = document.getElementById(prefix + '-choices');
  if (!el) return;
  el.style.display =
    force || (el.style.display === 'list-item' ? 'none' : 'list-item');
}
