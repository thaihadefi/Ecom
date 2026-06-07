// REVENUE CHART BY HOUR
const revenueChartHour = document.querySelector("#revenueChartHour");
if (revenueChartHour) {
  const ctx = revenueChartHour.getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labelsHour,
      datasets: [
        {
          label: "Today",
          data: todayData,
          borderWidth: 2,
          tension: 0.4,
          fill: false,
        },
        {
          label: "Yesterday",
          data: yesterdayData,
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return (
                context.dataset.label +
                ": " +
                context.parsed.y.toLocaleString('vi-VN') + ' VND'
              );
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: function (value) {
              return value.toLocaleString('vi-VN') + ' VND';
            },
          },
        },
      },
    },
  });
}
// END OF REVENUE CHART BY HOUR

// REVENUE CHART BY DAY
const revenueChartDay = document.querySelector("#revenueChartDay");
if (revenueChartDay) {
  const ctx = revenueChartDay.getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labelsDay,
      datasets: [
        {
          label: "This Month",
          data: thisMonthData,
          borderWidth: 2,
          tension: 0.4,
          fill: false,
        },
        {
          label: "Last Month",
          data: lastMonthData.slice(0, labelsDay.length), // Slice to match number of days
          borderDash: [5, 5],
          borderWidth: 2,
          tension: 0.4,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return (
                context.dataset.label +
                ": " +
                context.parsed.y.toLocaleString('vi-VN') + ' VND'
              );
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: function (value) {
              return value.toLocaleString('vi-VN') + ' VND';
            },
          },
        },
      },
    },
  });
}
// END OF REVENUE CHART BY DAY

// REVENUE CHART BY MONTH
const revenueChartMonth = document.querySelector("#revenueChartMonth");
if (revenueChartMonth) {
  const ctx = revenueChartMonth.getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labelsMonth,
      datasets: [
        {
          label: "Current Year",
          data: thisYearData,
          backgroundColor: "rgba(54, 162, 235, 0.7)",
        },
        {
          label: "Previous Year",
          data: lastYearData,
          backgroundColor: "rgba(255, 99, 132, 0.6)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${
                context.dataset.label
              }: ${context.raw.toLocaleString("vi-VN")} ₫`;
            },
          },
        },
        legend: {
          position: "top",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => value.toLocaleString("vi-VN") + " ₫",
          },
        },
      },
    },
  });
}
// END OF REVENUE CHART BY MONTH

const PIE_OPTIONS = {
  responsive: true,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        padding: 16,
        font: { size: 12 }
      }
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          const total = context.dataset.data.reduce((a, b) => a + b, 0);
          const value = context.parsed;
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          return ` ${context.label}: ${value} (${pct}%)`;
        }
      }
    }
  }
};

// ORDER STATUS RATIO BY DAY
const orderStatusToday = document.querySelector("#orderStatusToday");
if(orderStatusToday) {
  new Chart(orderStatusToday, { type: 'pie', data: pieToday, options: PIE_OPTIONS });
}
// END OF ORDER STATUS RATIO BY DAY

// ORDER STATUS RATIO BY MONTH
const orderStatusMonth = document.querySelector("#orderStatusMonth");
if(orderStatusMonth) {
  new Chart(orderStatusMonth, { type: 'pie', data: pieThisMonth, options: PIE_OPTIONS });
}
// END OF ORDER STATUS RATIO BY MONTH

// ORDER STATUS RATIO BY YEAR
const orderStatusYear = document.querySelector("#orderStatusYear");
if(orderStatusYear) {
  new Chart(orderStatusYear, { type: 'pie', data: pieThisYear, options: PIE_OPTIONS });
}
// END OF ORDER STATUS RATIO BY YEAR

// ─── AJAX FILTER: REVENUE ────────────────────────────────────────────────────
var _revenueCustomChart = null;

function reEnableSubmitButton() {
  var form = document.querySelector('[data-date-filter]');
  if (form) {
    var btn = form.querySelector('[type="submit"]');
    if (btn) {
      btn.classList.remove('is-loading');
      btn.removeAttribute('disabled');
    }
  }
}

function drawRevenueChart(from, to) {
  fetch('/admin/dashboard/revenue-by-time/data?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to))
    .then(function(r) { return r.json(); })
    .then(function(json) {
      reEnableSubmitButton();
      if (json.code !== 'success') return;

      var section        = document.querySelector('#revenueCustomSection');
      var defaultSection = document.querySelector('#revenueDefaultSection');
      var resetBtn       = document.querySelector('#btnRevenueReset');
      var titleEl        = document.querySelector('#revenueCustomTitle');
      var cardBody       = section.querySelector('.card-body');

      var granularityLabel = json.granularity === 'hour' ? 'Hour' : json.granularity === 'day' ? 'Day' : 'Month';
      if (titleEl) titleEl.textContent = 'Revenue by ' + granularityLabel + ': ' + from + ' → ' + to;

      if (_revenueCustomChart) { _revenueCustomChart.destroy(); _revenueCustomChart = null; }
      cardBody.innerHTML = '<canvas id="revenueChartCustom"></canvas>';

      _revenueCustomChart = new Chart(cardBody.querySelector('canvas'), {
        type: json.granularity === 'month' ? 'bar' : 'line',
        data: {
          labels: json.labels,
          datasets: [{
            label: 'Revenue (' + from + ' → ' + to + ')',
            data: json.data,
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            backgroundColor: 'rgba(54, 162, 235, 0.7)',
            borderColor: 'rgba(54, 162, 235, 1)',
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y.toLocaleString('vi-VN') + ' VND'; } } },
          },
          scales: { y: { beginAtZero: true, ticks: { callback: function(v) { return v.toLocaleString('vi-VN') + ' VND'; } } } },
        },
      });

      if (section)        section.style.display = '';
      if (defaultSection) defaultSection.style.display = 'none';
      if (resetBtn)       resetBtn.style.display = '';
      history.pushState({}, '', '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
    })
    .catch(function(err) {
      reEnableSubmitButton();
    });
}

var btnRevenueReset = document.querySelector('#btnRevenueReset');
if (btnRevenueReset) {
  btnRevenueReset.addEventListener('click', function() {
    var section        = document.querySelector('#revenueCustomSection');
    var defaultSection = document.querySelector('#revenueDefaultSection');
    var form           = document.querySelector('[data-date-filter]');
    if (_revenueCustomChart) { _revenueCustomChart.destroy(); _revenueCustomChart = null; }
    if (section)        section.style.display = 'none';
    if (defaultSection) defaultSection.style.display = '';
    if (form) { form.querySelector('[name="from"]').value = ''; form.querySelector('[name="to"]').value = ''; }
    btnRevenueReset.style.display = 'none';
    history.pushState({}, '', window.location.pathname);
  });
}

// ─── AJAX FILTER: ORDER STATISTIC ────────────────────────────────────────────
var _orderCustomChart = null;

function drawOrderChart(from, to) {
  fetch('/admin/dashboard/order-statistic/data?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to))
    .then(function(r) { return r.json(); })
    .then(function(json) {
      reEnableSubmitButton();
      if (json.code !== 'success') return;

      var section        = document.querySelector('#orderCustomSection');
      var defaultSection = document.querySelector('#orderDefaultSection');
      var resetBtn       = document.querySelector('#btnOrderReset');
      var titleEl        = document.querySelector('#orderCustomTitle');
      var cardBody       = section.querySelector('.card-body');

      if (titleEl) titleEl.textContent = 'Order Status: ' + from + ' → ' + to;

      if (_orderCustomChart) { _orderCustomChart.destroy(); _orderCustomChart = null; }
      cardBody.innerHTML = '<canvas id="orderStatusCustom"></canvas>';

      _orderCustomChart = new Chart(cardBody.querySelector('canvas'), {
        type: 'pie',
        data: json.pieCustom,
        options: PIE_OPTIONS,
      });

      if (section)        section.style.display = '';
      if (defaultSection) defaultSection.style.display = 'none';
      if (resetBtn)       resetBtn.style.display = '';
      history.pushState({}, '', '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
    })
    .catch(function(err) {
      reEnableSubmitButton();
    });
}

var btnOrderReset = document.querySelector('#btnOrderReset');
if (btnOrderReset) {
  btnOrderReset.addEventListener('click', function() {
    var section        = document.querySelector('#orderCustomSection');
    var defaultSection = document.querySelector('#orderDefaultSection');
    var form           = document.querySelector('[data-date-filter]');
    if (_orderCustomChart) { _orderCustomChart.destroy(); _orderCustomChart = null; }
    if (section)        section.style.display = 'none';
    if (defaultSection) defaultSection.style.display = '';
    if (form) { form.querySelector('[name="from"]').value = ''; form.querySelector('[name="to"]').value = ''; }
    btnOrderReset.style.display = 'none';
    history.pushState({}, '', window.location.pathname);
  });
}

// ─── EVENT: JustValidate onSuccess dispatches this ───────────────────────────
document.addEventListener('dashboard-filter-apply', function(e) {
  if (document.querySelector('#revenueDefaultSection')) {
    drawRevenueChart(e.detail.from, e.detail.to);
  } else if (document.querySelector('#orderDefaultSection')) {
    drawOrderChart(e.detail.from, e.detail.to);
  }
});

// ─── PAGE LOAD: restore filter from URL params ────────────────────────────────
(function() {
  var params  = new URLSearchParams(window.location.search);
  var urlFrom = params.get('from');
  var urlTo   = params.get('to');
  if (!urlFrom || !urlTo) return;

  var form = document.querySelector('[data-date-filter]');
  if (form) {
    form.querySelector('[name="from"]').value = urlFrom;
    form.querySelector('[name="to"]').value   = urlTo;
  }

  if (document.querySelector('#revenueDefaultSection')) {
    drawRevenueChart(urlFrom, urlTo);
  } else if (document.querySelector('#orderDefaultSection')) {
    drawOrderChart(urlFrom, urlTo);
  }
})();