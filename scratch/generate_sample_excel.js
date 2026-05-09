
const XLSX = require('xlsx');
const path = require('path');

const sampleProducts = [
  { sku: '12345', title: 'AMORTIGUADOR DELANTERO CHEVROLET AVEO', price: 45.5, stock: 10, line: 'SUSPENSION', sub: 'AMORTIGUADORES', oem: '96410169', cat_id: 'MLV1234', cat_name: 'Amortiguadores' },
  { sku: '22334', title: 'PASTILLAS DE FRENO TOYOTA COROLLA 2009-2014', price: 25.0, stock: 25, line: 'FRENOS', sub: 'PASTILLAS', oem: '04465-02220', cat_id: 'MLV5678', cat_name: 'Pastillas de Freno' },
  { sku: 'BOM-001', title: 'BOMBA DE AGUA MITSUBISHI LANCER 1.6', price: 38.0, stock: 5, line: 'MOTOR', sub: 'BOMBAS DE AGUA', oem: 'MD365087', cat_id: 'MLV9012', cat_name: 'Bombas de Agua' },
  { sku: 'FIL-102', title: 'FILTRO DE AIRE HYUNDAI GETZ', price: 8.5, stock: 50, line: 'FILTROS', sub: 'AIRE', oem: '28113-1C000', cat_id: 'MLV3456', cat_name: 'Filtros de Aire' },
  { sku: 'KIT-EMB', title: 'KIT DE EMBRAGUE FORD FIESTA POWER', price: 120.0, stock: 3, line: 'TRANSMISION', sub: 'EMBRAGUES', oem: '2S61-7540-AB', cat_id: 'MLV7890', cat_name: 'Kits de Embrague' },
  { sku: 'ROT-55', title: 'ROTULA DE DIRECCION HONDA CIVIC 2001-2005', price: 15.0, stock: 12, line: 'DIRECCION', sub: 'ROTULAS', oem: '51220-S5A-003', cat_id: 'MLV2143', cat_name: 'Rótulas' },
  { sku: 'COR-09', title: 'CORREA DE TIEMPO GATES TOYOTA YARIS', price: 22.0, stock: 18, line: 'MOTOR', sub: 'CORREAS', oem: '13568-19135', cat_id: 'MLV6543', cat_name: 'Correas de Distribución' },
  { sku: 'EST-99', title: 'ESTOPERA DE CIGUEÑAL TRASERA NISSAN SENTRA', price: 12.0, stock: 20, line: 'MOTOR', sub: 'ESTOPERAS', oem: '12279-00Q0A', cat_id: 'MLV8765', cat_name: 'Retenes' },
  { sku: 'BUJ-20', title: 'BUJE DE MESETA INFERIOR MAZDA 3', price: 7.5, stock: 40, line: 'SUSPENSION', sub: 'BUJES', oem: 'B32H-34-470A', cat_id: 'MLV1092', cat_name: 'Bujes' },
  { sku: 'ROD-30', title: 'RODAMIENTO RUEDA TRASERA SUZUKI SWIFT', price: 28.0, stock: 8, line: 'RODAMIENTOS', sub: 'RUEDA', oem: '43440-54G00', cat_id: 'MLV3124', cat_name: 'Rodamientos de Rueda' },
  { sku: 'JUN-50', title: 'JUNTA DE CAMARA CHEVROLET OPTRA LIMITED', price: 18.0, stock: 15, line: 'MOTOR', sub: 'JUNTAS', oem: '92062222', cat_id: 'MLV5321', cat_name: 'Juntas de Motor' },
  { sku: 'BOM-002', title: 'BOMBA DE GASOLINA FORD EXPLORER 4.6', price: 65.0, stock: 6, line: 'MOTOR', sub: 'BOMBAS DE GASOLINA', oem: 'E2455M', cat_id: 'MLV7532', cat_name: 'Bombas de Combustible' },
  { sku: 'DIS-10', title: 'DISCO DE FRENO DELANTERO VW GOL', price: 32.0, stock: 10, line: 'FRENOS', sub: 'DISCOS', oem: '321615301D', cat_id: 'MLV9642', cat_name: 'Discos de Freno' },
  { sku: 'TER-01', title: 'TERMINAL DE DIRECCION IZQ KIA RIO', price: 14.0, stock: 14, line: 'DIRECCION', sub: 'TERMINALES', oem: 'OK30A-32-290', cat_id: 'MLV1470', cat_name: 'Terminales de Dirección' },
  { sku: 'BAS-88', title: 'BASE DE MOTOR DERECHA HONDA ACCORD', price: 55.0, stock: 4, line: 'MOTOR', sub: 'BASES', oem: '50820-SDA-A01', cat_id: 'MLV2580', cat_name: 'Bases de Motor' },
  { sku: 'GUA-05', title: 'GUARDAPOLVO TRIPOIDE LADO CAJA TOYOTA', price: 10.0, stock: 22, line: 'TRANSMISION', sub: 'GUARDAPOLVOS', oem: '04438-02050', cat_id: 'MLV3690', cat_name: 'Guardapolvos' },
  { sku: 'PIL-44', title: 'PILA DE GASOLINA BOSCH UNIVERSAL', price: 20.0, stock: 30, line: 'MOTOR', sub: 'BOMBAS DE GASOLINA', oem: '0580453477', cat_id: 'MLV7532', cat_name: 'Bombas de Combustible' },
  { sku: 'VAL-01', title: 'VALVULA DE ADMISION TOYOTA HILUX 2.7', price: 9.0, stock: 16, line: 'MOTOR', sub: 'VALVULAS', oem: '13711-75020', cat_id: 'MLV1590', cat_name: 'Válvulas' },
  { sku: 'TRI-12', title: 'TRIPOIDE LADO RUEDA RENAULT LOGAN', price: 42.0, stock: 7, line: 'TRANSMISION', sub: 'TRIPOIDES', oem: '8200504104', cat_id: 'MLV4821', cat_name: 'Semiejes y Homocinéticas' },
  { sku: 'FIL-200', title: 'FILTRO DE ACEITE CHRYSLER NEON', price: 6.0, stock: 45, line: 'FILTROS', sub: 'ACEITE', oem: '05281090', cat_id: 'MLV3457', cat_name: 'Filtros de Aceite' }
];

const headers = [
  'Línea Profit', 'Sublínea Profit', 'Breadcrumb Profit', 'Título', 'Cantidad de caracteres', 'Condición', 'Fotos', 'SKU',
  'Stock', 'Precio [US$]', 'Descripción', 'Tipo de publicación',
  'Cargo por venta', 'Forma de envío', 'Costo de envío',
  'Retiro en persona', 'Tipo de garantía', 'Tiempo de garantía',
  'Unidad de Tiempo de garantía', 'Marca', 'Número de pieza',
  'ID Categoría ML', 'Nombre Categoría ML'
];

const rows = sampleProducts.map(p => [
  p.line,
  p.sub,
  `${p.line} > ${p.sub}`,
  p.title,
  p.title.length,
  'Nuevo',
  'https://http2.mlstatic.com/D_641016-MLV74512345678_022024-O.jpg',
  p.sku,
  p.stock,
  p.price,
  `Producto Original. SKU: ${p.sku}. Código OEM: ${p.oem}.`,
  'Premium',
  '-',
  'Mercado Envíos',
  'Envío gratis',
  'Acepto',
  'Garantía del vendedor',
  '30',
  'días',
  'Genérico',
  p.oem,
  p.cat_id,
  p.cat_name
]);

const data = [headers, ...rows];
const worksheet = XLSX.utils.aoa_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Publicacion_Unificada');

// Ajustar anchos
worksheet['!cols'] = headers.map(h => ({
  wch: h === 'Título' ? 50 : h.includes('Breadcrumb') ? 40 : h === 'Descripción' ? 60 : h === 'Fotos' ? 80 : 20
}));

const filePath = path.join(__dirname, 'Muestra_Auditoria_Profit.xlsx');
XLSX.writeFile(workbook, filePath);

console.log('Archivo generado en:', filePath);
