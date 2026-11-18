const categories = ["Food","Travel","Shopping","Bills","Education","Health","Entertainment","Other"];
const palette = ["#8b79e6","#59b8a1","#eda65e","#6d9fdb","#d77ea4","#69b9c8","#a8b86a","#a2a8b4"];
let expenses = [];
let editingId = null;

const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(value);

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2300);
}
function getCategoryColor(category) {
  return palette[categories.indexOf(category)] || palette[7];
}
function updateSummary() {
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const now = new Date();
  const monthTotal = expenses.filter(item => {
    const date = new Date(`${item.date}T00:00:00`);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).reduce((sum, item) => sum + item.amount, 0);
  $("totalExpenses").textContent = money(total);
  $("monthExpenses").textContent = money(monthTotal);
  $("transactionCount").textContent = expenses.length;
  $("averageExpense").textContent = money(expenses.length ? total / expenses.length : 0);
  $("chartTotal").textContent = money(total);
}
function drawChart() {
  const canvas = $("categoryChart");
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  ctx.scale(ratio, ratio);
  const size = rect.width;
  const cx = size / 2, cy = size / 2, radius = size * .39, thickness = size * .15;
  const totals = categories.map(category => ({
    category,
    amount: expenses.filter(item => item.category === category).reduce((sum, item) => sum + item.amount, 0)
  })).filter(item => item.amount > 0);
  const total = totals.reduce((sum, item) => sum + item.amount, 0);
  ctx.lineWidth = thickness;
  ctx.lineCap = "butt";
  if (!total) {
    ctx.beginPath(); ctx.strokeStyle = "#f0f1f5"; ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    $("categoryLegend").innerHTML = '<div class="empty-chart">Add an expense to see your breakdown.</div>';
    return;
  }
  let start = -Math.PI / 2;
  totals.forEach(item => {
    const angle = item.amount / total * Math.PI * 2;
    ctx.beginPath(); ctx.strokeStyle = getCategoryColor(item.category);
    ctx.arc(cx, cy, radius, start, start + angle); ctx.stroke();
    start += angle;
  });
  $("categoryLegend").innerHTML = totals.sort((a,b) => b.amount-a.amount).map(item =>
    `<div class="legend-item"><span class="legend-dot" style="background:${getCategoryColor(item.category)}"></span><span class="legend-name">${item.category}</span><strong class="legend-value">${money(item.amount)}</strong></div>`
  ).join("");
}
function renderTransactions() {
  const search = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const filtered = expenses.filter(item => {
    const matchesSearch = `${item.title} ${item.note} ${item.category}`.toLowerCase().includes(search);
    return matchesSearch && (category === "All" || item.category === category);
  }).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt);
  const body = $("transactionBody");
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-row">${expenses.length ? "No transactions match your filters." : "No expenses yet. Add your first transaction above."}</td></tr>`;
  } else {
    body.innerHTML = filtered.map(item => `
      <tr>
        <td><div class="expense-name">${escapeHTML(item.title)}</div>${item.note ? `<div class="expense-note">${escapeHTML(item.note)}</div>` : ""}</td>
        <td><span class="category-chip" style="--chip:${getCategoryColor(item.category)}"><i></i>${item.category}</span></td>
        <td>${formatDate(item.date)}</td>
        <td class="amount">${money(item.amount)}</td>
        <td><div class="row-actions"><button class="icon-button" data-edit="${item.id}" aria-label="Edit ${escapeHTML(item.title)}">Edit</button><button class="icon-button" data-delete="${item.id}" aria-label="Delete ${escapeHTML(item.title)}">Delete</button></div></td>
      </tr>`).join("");
  }
  $("showingCount").textContent = `Showing ${filtered.length} of ${expenses.length} transactions`;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {day:"2-digit",month:"short",year:"numeric"});
}
function render() {
  updateSummary();
  drawChart();
  renderTransactions();
}
function resetForm() {
  $("expenseForm").reset();
  $("expenseId").value = "";
  $("expenseDate").value = todayISO();
  $("saveExpense").textContent = "＋ Save expense";
  $("cancelEdit").classList.add("hidden");
  editingId = null;
}
function editExpense(id) {
  const item = expenses.find(expense => expense.id === id);
  if (!item) return;
  editingId = id;
  $("expenseTitle").value = item.title;
  $("expenseAmount").value = item.amount;
  $("expenseDate").value = item.date;
  $("expenseCategory").value = item.category;
  $("expenseNote").value = item.note;
  $("saveExpense").textContent = "Update expense";
  $("cancelEdit").classList.remove("hidden");
  $("expenseTitle").focus();
  document.querySelector(".quick-panel").scrollIntoView({behavior:"smooth",block:"center"});
}
$("expenseForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("expenseTitle").value.trim();
  const amount = Number($("expenseAmount").value);
  const date = $("expenseDate").value;
  const category = $("expenseCategory").value;
  const note = $("expenseNote").value.trim();
  if (!title || !Number.isFinite(amount) || amount <= 0 || !date || !categories.includes(category)) {
    $("formMessage").textContent = "Please enter a valid name, amount, date and category.";
    return;
  }
  if (editingId) {
    const item = expenses.find(expense => expense.id === editingId);
    Object.assign(item, {title, amount, date, category, note});
    showToast("Expense updated successfully.");
  } else {
    expenses.push({id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, title, amount, date, category, note, createdAt: Date.now()});
    showToast("Expense added successfully.");
  }
  $("formMessage").textContent = "";
  resetForm();
  render();
});
$("transactionBody").addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) editExpense(editButton.dataset.edit);
  if (deleteButton) {
    const id = deleteButton.dataset.delete;
    const item = expenses.find(expense => expense.id === id);
    if (item && confirm(`Delete "${item.title}"?`)) {
      expenses = expenses.filter(expense => expense.id !== id);
      if (editingId === id) resetForm();
      render(); showToast("Expense deleted.");
    }
  }
});
$("cancelEdit").addEventListener("click", resetForm);
$("searchInput").addEventListener("input", renderTransactions);
$("categoryFilter").addEventListener("change", renderTransactions);
$("openAddTop").addEventListener("click", () => {
  $("expenseTitle").focus();
  document.querySelector(".quick-panel").scrollIntoView({behavior:"smooth",block:"center"});
});
$("clearAll").addEventListener("click", () => {
  if (!expenses.length) { showToast("There are no records to clear."); return; }
  if (confirm("Clear all expense records? This cannot be undone.")) {
    expenses = []; resetForm(); render(); showToast("All expense records cleared.");
  }
});
$("exportCsv").addEventListener("click", () => {
  if (!expenses.length) { showToast("Add an expense before exporting."); return; }
  const rows = [["Expense","Amount (INR)","Category","Date","Note"], ...expenses.map(item => [item.title,item.amount,item.category,item.date,item.note])];
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "personal-expenses.csv"; link.click();
  URL.revokeObjectURL(url); showToast("CSV file exported.");
});
$("todayLabel").textContent = new Date().toLocaleDateString("en-IN", {weekday:"short",day:"2-digit",month:"short",year:"numeric"});
$("expenseDate").value = todayISO();
render();
window.addEventListener("resize", drawChart);
