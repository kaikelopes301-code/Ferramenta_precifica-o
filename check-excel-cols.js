import XLSX from 'xlsx';
const wb = XLSX.readFile('./data/dados_internos.xlsx');
const ws = wb.Sheets['dados'];
const rows = XLSX.utils.sheet_to_json(ws);
console.log('\n=== COLUNAS DISPONÍVEIS NO EXCEL ===\n');
Object.keys(rows[0]).forEach((col, i) => {
  console.log(`${String(i+1).padStart(2)}. "${col}"`);
});
console.log(`\nTotal: ${Object.keys(rows[0]).length} colunas\n`);
