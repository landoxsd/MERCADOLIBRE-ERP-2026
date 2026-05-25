import { NextResponse } from "next/server";

export async function POST(request) {
    try {
        const { items } = await request.json();
        if (!items || items.length === 0) {
            return NextResponse.json({ error: "No hay items para exportar" }, { status: 400 });
        }

        // Generar CSV BOM UTF-8 compatible con Integraly/Excel
        const BOM = '\uFEFF';
        const headers = ['SKU', 'ITEM_ID', 'TITULO_NUEVO', 'DESCRIPCION_NUEVA', 'PRECIO_NUEVO', 'SCORE_ANTES', 'FECHA_GENERACION'];

        const escape = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val).replace(/"/g, '""');
            return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
        };

        const rows = items.map(item => [
            escape(item.sku || ''),
            escape(item.item_id || ''),
            escape(item.nuevo_titulo || ''),
            escape(item.nueva_descripcion || ''),
            escape(item.nuevo_precio || ''),
            escape(item.score_antes || ''),
            escape(new Date().toISOString().split('T')[0])
        ].join(','));

        const csv = BOM + headers.join(',') + '\n' + rows.join('\n');
        const today = new Date().toISOString().split('T')[0];

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="INTEGRALY_OPTIMIZER_${today}.csv"`,
            }
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
