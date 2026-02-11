import React, { useState, useEffect, useRef } from 'react';
import {
    getSuppliers,
    Supplier,
    createPurchaseDocument,
    createPurchaseLines,
    getWorkOrderByNumber,
    getPartByNumber,
    updateWorkOrderPartCost,
    getActiveWorkOrders,
    getWorkOrderParts,
    manualMatchPurchaseLine,
    createWorkOrderPart
} from '../services/supabaseClient';
import { PurchaseDocument, PurchaseLine } from '../types';

const PurchaseImporter: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [docType, setDocType] = useState<'invoice' | 'delivery_note'>('invoice');
    const [docNumber, setDocNumber] = useState('');
    const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);

    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState<{
        total: number,
        matched: number,
        pending: number,
        lines: any[]
    } | null>(null);

    // Module D: Manual Matching State
    const [activeWorkOrders, setActiveWorkOrders] = useState<any[]>([]);
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [selectedLine, setSelectedLine] = useState<any | null>(null);
    const [selectedWoId, setSelectedWoId] = useState('');
    const [woParts, setWoParts] = useState<any[]>([]);
    const [selectedPartId, setSelectedPartId] = useState('');
    const [isCreatingPart, setIsCreatingPart] = useState(false);
    const [newPartDescription, setNewPartDescription] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadSuppliers();
        loadWorkOrders();
    }, []);

    const loadSuppliers = async () => {
        const data = await getSuppliers();
        setSuppliers(data);
    };

    const loadWorkOrders = async () => {
        const data = await getActiveWorkOrders();
        setActiveWorkOrders(data);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const parseCSV = (text: string) => {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        return lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj: any = {};
            headers.forEach((header, i) => {
                obj[header] = values[i];
            });
            return obj;
        });
    };

    const runImport = async () => {
        if (!file || !selectedSupplier || !docNumber) {
            alert("Por favor, completa todos los campos.");
            return;
        }

        setImporting(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                const rawLines = parseCSV(text);

                // 1. Create Document
                const doc = await createPurchaseDocument({
                    supplier_id: selectedSupplier,
                    document_number: docNumber,
                    document_date: docDate,
                    document_type: docType,
                    status: 'imported'
                });

                if (!doc) throw new Error("Error al crear el documento de compra.");

                const processedLines: any[] = [];
                let matchedCount = 0;

                // 2. Process Lines
                for (const raw of rawLines) {
                    const sku = raw.sku || raw.referencia || '';
                    const description = raw.description || raw.descripcion || '';
                    const quantity = parseFloat(raw.quantity || raw.cantidad || '1');
                    const unitPrice = parseFloat(raw.unit_price || raw.precio || '0');
                    const woRef = raw.wo_reference || raw.expediente || '';

                    let matchedWoId: string | undefined;
                    let matchedPartId: string | undefined;
                    let matchingStatus: 'pending' | 'matched' | 'no_match' = 'pending';

                    // Automatic matching logic
                    if (woRef) {
                        const wo = await getWorkOrderByNumber(woRef);
                        if (wo) {
                            matchedWoId = wo.id;
                            const part = await getPartByNumber(wo.id, sku);
                            if (part) {
                                matchedPartId = part.id;
                                matchingStatus = 'matched';
                                matchedCount++;
                                await updateWorkOrderPartCost(part.id, unitPrice * quantity);
                            } else {
                                matchingStatus = 'pending'; // Changed to pending so we can manually match
                            }
                        }
                    }

                    processedLines.push({
                        id: crypto.randomUUID(), // Optimistic ID for UI
                        purchase_document_id: doc.id,
                        sku,
                        description,
                        quantity,
                        unit_price: unitPrice,
                        total_amount: unitPrice * quantity,
                        work_order_id: matchedWoId,
                        work_order_part_id: matchedPartId,
                        matching_status: matchingStatus
                    });
                }

                // 3. Save Lines
                const savedLines = await createPurchaseLines(processedLines.map(({ id, ...rest }) => rest));


                setResults({
                    total: processedLines.length,
                    matched: matchedCount,
                    pending: processedLines.length - matchedCount,
                    lines: processedLines
                });
                setImporting(false);
            };
            reader.readAsText(file);
        } catch (err: any) {
            alert(err.message);
            setImporting(false);
        }
    };

    // --- Manual Matching Logic ---

    const openMatchModal = (line: any) => {
        setSelectedLine(line);
        setSelectedWoId('');
        setWoParts([]);
        setSelectedPartId('');
        setIsCreatingPart(false);
        setNewPartDescription(line.description);
        setShowMatchModal(true);
    };

    const handleWoSelect = async (woId: string) => {
        setSelectedWoId(woId);
        const parts = await getWorkOrderParts(woId);
        setWoParts(parts);
    };

    const handleConfirmMatch = async () => {
        if (!selectedLine || !selectedWoId) return;

        let finalPartId = selectedPartId;

        if (isCreatingPart) {
            // Create part first
            const newPart = await createWorkOrderPart(selectedWoId, {
                part_number: selectedLine.sku || 'N/A',
                description: newPartDescription,
                quantity: selectedLine.quantity,
                unit_price: selectedLine.unit_price * 1.2, // Default markup?
                cost_price: selectedLine.total_amount,
                supplier_id: selectedSupplier
            });
            if (newPart) {
                finalPartId = newPart.id;
            } else {
                alert("Error creando el recambio.");
                return;
            }
        }

        if (!finalPartId) {
            alert("Debes seleccionar un recambio o crear uno nuevo.");
            return;
        }

        // Match
        if (selectedLine.id) {
            const success = await manualMatchPurchaseLine(selectedLine.id, selectedWoId, finalPartId, selectedLine.total_amount);
            if (success) {
                // Update local state
                const newLines = results?.lines.map(l =>
                    l === selectedLine ? { ...l, matching_status: 'matched', work_order_part_id: finalPartId } : l
                );
                if (newLines && results) {
                    setResults({
                        ...results,
                        lines: newLines,
                        matched: results.matched + 1,
                        pending: results.pending - 1
                    });
                    setShowMatchModal(false);
                }
            } else {
                alert("Error al vincular.");
            }
        } else {
            alert("ID de línea no encontrado. Por favor recarga la página.");
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 animate-fade-in relative">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-slate-900 p-8 text-white">
                    <h2 className="text-2xl font-black tracking-tight">Importador de Compras</h2>
                    <p className="text-slate-400 text-sm">Carga facturas y albaranes para conciliar costos de recambios.</p>
                </div>

                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Proveedor</label>
                            <select
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                value={selectedSupplier}
                                onChange={e => setSelectedSupplier(e.target.value)}
                            >
                                <option value="">Seleccionar Proveedor</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Tipo de Documento</label>
                            <div className="flex bg-slate-100 p-1 rounded-2xl">
                                <button
                                    onClick={() => setDocType('invoice')}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${docType === 'invoice' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Factura
                                </button>
                                <button
                                    onClick={() => setDocType('delivery_note')}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${docType === 'delivery_note' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Albarán
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Nº Documento</label>
                            <input
                                type="text"
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono"
                                placeholder="Ej: F-2026-001"
                                value={docNumber}
                                onChange={e => setDocNumber(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Fecha</label>
                            <input
                                type="date"
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                value={docDate}
                                onChange={e => setDocDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {!results ? (
                        <div className="space-y-6">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-3 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${file ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}
                            >
                                <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">{file ? file.name : 'Seleccionar Archivo CSV'}</h3>
                                <p className="text-slate-500 text-sm mt-1">El archivo debe contener columnas: SKU, Description, Quantity, Unit_Price, WO_Reference</p>
                            </div>

                            <button
                                onClick={runImport}
                                disabled={importing || !file || !selectedSupplier || !docNumber}
                                className="w-full py-5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-brand-100 disabled:opacity-50 disabled:grayscale"
                            >
                                {importing ? 'PROCESANDO...' : 'IMPORTAR Y CONCILIAR'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Líneas</p>
                                    <p className="text-3xl font-black text-slate-900">{results.total}</p>
                                </div>
                                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Conciliadas</p>
                                    <p className="text-3xl font-black text-emerald-600">{results.matched}</p>
                                </div>
                                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Pendientes</p>
                                    <p className="text-3xl font-black text-amber-600">{results.pending}</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-white border-b border-slate-200">
                                        <tr>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase">Referencia</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase">Descripción</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase text-right">Importe</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase text-center">Estado</th>
                                            <th className="p-4 text-[10px] font-black text-slate-500 uppercase text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {results.lines.map((l, i) => (
                                            <tr key={i}>
                                                <td className="p-4 font-mono text-xs font-bold text-slate-700">{l.sku}</td>
                                                <td className="p-4 text-xs font-medium text-slate-600">{l.description}</td>
                                                <td className="p-4 text-xs font-black text-slate-900 text-right">{l.total_amount.toFixed(2)} €</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${l.matching_status === 'matched' ? 'bg-emerald-100 text-emerald-600' :
                                                        l.matching_status === 'no_match' ? 'bg-amber-100 text-amber-600' :
                                                            'bg-slate-200 text-slate-600'
                                                        }`}>
                                                        {l.matching_status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {l.matching_status !== 'matched' && (
                                                        <button
                                                            onClick={() => openMatchModal(l)}
                                                            className="text-[10px] font-bold text-brand-600 hover:underline uppercase"
                                                        >
                                                            Vincular OT
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <button
                                onClick={() => { setResults(null); setFile(null); setDocNumber(''); }}
                                className="w-full py-4 border-2 border-slate-200 text-slate-500 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                            >
                                CARGAR OTRO DOCUMENTO
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL MATCHING */}
            {showMatchModal && selectedLine && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-in">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <h3 className="font-bold">Vincular Línea a OT</h3>
                            <button onClick={() => setShowMatchModal(false)} className="text-white/50 hover:text-white">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl text-sm">
                                <p className="font-bold text-slate-900">{selectedLine.description}</p>
                                <div className="flex justify-between mt-1 text-xs text-slate-500">
                                    <span>SKU: {selectedLine.sku}</span>
                                    <span>Total: {selectedLine.total_amount.toFixed(2)} €</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase">Orden de Trabajo</label>
                                <select
                                    className="w-full p-3 border rounded-xl bg-white"
                                    value={selectedWoId}
                                    onChange={(e) => handleWoSelect(e.target.value)}
                                >
                                    <option value="">Seleccionar OT...</option>
                                    {activeWorkOrders.map(wo => (
                                        <option key={wo.id} value={wo.id}>
                                            {wo.number || wo.work_order_number} - {wo.license_plate} ({wo.vehicle_model})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedWoId && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="radio" checked={!isCreatingPart} onChange={() => setIsCreatingPart(false)} />
                                            Asignar a Recambio Existente
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="radio" checked={isCreatingPart} onChange={() => setIsCreatingPart(true)} />
                                            Crear Nuevo Recambio
                                        </label>
                                    </div>

                                    {!isCreatingPart ? (
                                        <select
                                            className="w-full p-3 border rounded-xl bg-white"
                                            value={selectedPartId}
                                            onChange={(e) => setSelectedPartId(e.target.value)}
                                        >
                                            <option value="">Seleccionar Recambio...</option>
                                            {woParts.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.part_number} - {p.description} (Original: {p.cost_price}€)
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                className="w-full p-3 border rounded-xl"
                                                placeholder="Descripción del nuevo recambio"
                                                value={newPartDescription}
                                                onChange={e => setNewPartDescription(e.target.value)}
                                            />
                                            <p className="text-[10px] text-amber-600 font-bold">* Se creará un nuevo recambio en la OT y se asignará este coste.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-6 flex justify-end gap-3">
                                <button onClick={() => setShowMatchModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm font-bold">Cancelar</button>
                                <button onClick={handleConfirmMatch} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-brand-700">Confirmar Vinculación</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchaseImporter;
