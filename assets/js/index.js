function getCertificateReportsGroupedPerDomain(link = false) {
  const addedDomains = new Map();
  const data = [];

  const getDomainIndex = (domain) => {
    let domainIndex = addedDomains.get(domain);
    if (domainIndex === undefined) {
      const index =
        data.push({
          id: `domain-${domain}`,
          name: domain,
          value: 40,
          linkWith: [],
          children: [],
        }) - 1;
      addedDomains.set(domain, index);
      domainIndex = index;
    }
    return domainIndex;
  };

  for (const certificateReport of baseChartData) {
    const domainIndex = getDomainIndex(certificateReport.queriedDomain);
    const currentDomainIndex = getDomainIndex(certificateReport.domain);
    data[domainIndex].value = (data[domainIndex].value ?? 0) + 1;
    data[currentDomainIndex].value = (data[currentDomainIndex].value ?? 0) + 1;
    data[currentDomainIndex].children.push({
      id: `cn-${certificateReport.commonName}`,
      name: certificateReport.commonName,
      value: 25,
      linkWith: !link ? [] : [`domain-${certificateReport.queriedDomain}`],
      httpStatus: certificateReport.httpStatus,
      resolvedIpAddress: certificateReport.resolvedIpAddress,
      lastIssuanceDate: certificateReport.date
        ? new Date(certificateReport.date)
        : null,
    });
  }
  return data;
}

function getCertificateReportsGroupedPerIp() {
  const addedIps = new Map();
  const data = [];

  for (const certificateReport of baseChartData) {
    if (!certificateReport.resolvedIpAddress) continue;
    let ipIndex = addedIps.get(certificateReport.resolvedIpAddress);
    if (ipIndex === undefined) {
      const index =
        data.push({
          id: `ip-${certificateReport.resolvedIpAddress}`,
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
      id: `cn-${certificateReport.commonName}`,
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

let PER_DOMAIN = null;
let PER_DOMAIN_WITH_LINKS = null;
let PER_IP = null;
let CHART_DATA_UNFILTERED = null;

let START_DATE = null;
let END_DATE = null;

am4core.useTheme(am4themes_animated);

const circleLabelSize = 15;
const resolvedIpAddressLabelSize = 10;

let chart;
let networkSeries;
let nodeTemplate;

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
  createChart();
  if (!PER_DOMAIN) {
    PER_DOMAIN = getCertificateReportsGroupedPerDomain();
  }
  if (!PER_DOMAIN_WITH_LINKS) {
    PER_DOMAIN_WITH_LINKS = getCertificateReportsGroupedPerDomain(true);
  }
  if (!PER_IP) {
    PER_IP = getCertificateReportsGroupedPerIp();
  }
  const isDomainChart = options.mode === 'domains';
  chart.data = isDomainChart
    ? options.link
      ? PER_DOMAIN_WITH_LINKS
      : PER_DOMAIN
    : PER_IP;
  CHART_DATA_UNFILTERED = chart.data;
  setChartDataWithFilters();

  nodeTemplate.adapter.add('tooltipText', function (text, target, key) {
    if (target.dataItem.dataContext.lastIssuanceDate) {
      return getTooltipTemplateForCommonName(
        target.dataItem.dataContext,
        isDomainChart
      );
    } else {
      return isDomainChart ? '[bold]Domain:[/] {name}' : '[bold]IP:[/] {name}';
    }
  });

  nodeTemplate.circle.events.on('ready', function (event) {
    if (event.target.parent.children.length > 3) return;
    const dataContext = event.target.parent.dataItem.dataContext;
    if (
      !dataContext.resolvedIpAddress ||
      (!isDomainChart && !dataContext.httpStatus)
    )
      return;

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
      return (
        subitem.lastIssuanceDate &&
        (!START_DATE || START_DATE <= subitem.lastIssuanceDate) &&
        (!END_DATE || END_DATE >= subitem.lastIssuanceDate)
      );
    }),
  })).filter((item) => !!item.children.length);
}
