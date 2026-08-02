/* Reports, Chart.js visualizations, PDF export and smart tips. */

let reportChart = null;

function renderReport() {
  const chartCanvas = document.getElementById('report-chart');
  if (!chartCanvas) return;

  const catTotals = {};
  let totalIncome = 0;
  let totalExpense = 0;

  (entries || []).forEach(e => {
    const amt = parseFloat(e.amt) || 0;
    if (e.type === 'income') {
      totalIncome += amt;
    } else if (e.type === 'expense') {
      totalExpense += amt;
      const cat = e.cat || 'other';
      catTotals[cat] = (catTotals[cat] || 0) + amt;
    }
  });

  const summaryEl = document.getElementById('report-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="grid2" style="margin-bottom:15px;">
        <div class="metric">
          <div class="metric-label">Total Income</div>
          <div class="metric-val green">₹${totalIncome}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Total Expense</div>
          <div class="metric-val red">₹${totalExpense}</div>
        </div>
      </div>
    `;
  }

  const labels = Object.keys(catTotals).map(c => c.toUpperCase());
  const data = Object.values(catTotals);

  if (typeof Chart !== 'undefined') {
    if (reportChart) reportChart.destroy();

    reportChart = new Chart(chartCanvas, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['NO DATA'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: [
            '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#ffffff' } }
        }
      }
    });
  }
}

function exportPDFReport() {
  if (typeof jspdf === 'undefined') {
    toast('PDF library loading, try again in a second', 'info');
    return;
  }

  const { jsPDF } = jspdf;
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text('PocketTrack — Financial Report', 20, 20);

  doc.setFontSize(12);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);

  let y = 45;
  doc.text('Summary:', 20, y);
  y += 10;

  let totalInc = 0, totalExp = 0;
  entries.forEach(e => {
    if (e.type === 'income') totalInc += (parseFloat(e.amt) || 0);
    else totalExp += (parseFloat(e.amt) || 0);
  });

  doc.text(`Total Income: Rs. ${totalInc}`, 25, y); y += 8;
  doc.text(`Total Expense: Rs. ${totalExp}`, 25, y); y += 8;
  doc.text(`Net Balance: Rs. ${totalInc - totalExp}`, 25, y); y += 15;

  doc.text('Recent Transactions:', 20, y); y += 10;

  entries.slice(0, 15).forEach((e, idx) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(`${idx + 1}. [${e.date}] ${e.type.toUpperCase()} - ${e.label || e.cat}: Rs. ${e.amt}`, 25, y);
    y += 7;
  });

  doc.save('PocketTrack_Report.pdf');
  toast('PDF report downloaded!', 'success');
}

function showNextTip() {
  const tips = [
    '💡 Tip: Track daily expenses using voice commands for 3x faster logging!',
    '💡 Tip: Review your Subscription Leak Detector monthly to save up to ₹15,000/yr.',
    '💡 Tip: Maintain a 7-day logging streak to boost your Financial Health Score!',
    '💡 Tip: Use Person Ledgers to settle shared restaurant bills with zero math errors.'
  ];
  const tipEl = document.getElementById('report-tip-text');
  if (tipEl) {
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    tipEl.textContent = randomTip;
  }
}
