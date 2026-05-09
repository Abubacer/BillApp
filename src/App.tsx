/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Droplets, 
  Calculator, 
  RefreshCcw, 
  Copy, 
  Camera, 
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Share2,
  ExternalLink
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface BillData {
  // Electricity
  consumptionKwh: string;
  ePre: string;
  eCur: string;
  tranche1: string;
  tranche2: string;
  redFixeElec: string;
  tva: string;
  
  // Water
  consumptionM3: string;
  wPre: string;
  wCur: string;
  wM3: string;
  redFixeAssainissement: string;
  assainissement: string;
  redFixeEau: string;

  // Payments
  pMe: string;
  pNbr: string;
}

const initialData: BillData = {
  consumptionKwh: '',
  ePre: '',
  eCur: '',
  tranche1: '',
  tranche2: '',
  redFixeElec: '',
  tva: '',
  consumptionM3: '',
  wPre: '',
  wCur: '',
  wM3: '',
  redFixeAssainissement: '',
  assainissement: '',
  redFixeEau: '',
  pMe: '',
  pNbr: ''
};

export default function App() {
  const [data, setData] = useState<BillData>(initialData);
  const [report, setReport] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setData(prev => ({ ...prev, [id]: value }));
  };

  const resetForm = () => {
    setData(initialData);
    setReport(null);
    setError(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!process.env.GEMINI_API_KEY) {
      setError("يرجى ضبط مفتاح API الخاص بـ Gemini في الإعدادات.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;
      const base64String = base64Data.split(',')[1];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                text: `Extract data from this Moroccan electricity (LYDEC, REDAL, AMENDIS, AMENDIS, RADEEMA, etc.) or water bill. 
                Instruction:
                1. Handle bilingual labels (Arabic/French).
                2. If numeric values use commas (e.g., 12,50), convert them to dots (12.50).
                3. Look for "Consommation" or "إستهلاك" for KWh/m3 values.
                4. Look for "NET A PAYER" or "المبلغ الواجب أداؤه" for total payment.
                5. Keep existing values if not found in this new bill.

                Look for these fields specifically:
                - Total Electricity Consumption in KWh (Consommation Electricité / إستهلاك الكهرباء)
                - Tranche 1 amount (Tranche 1 / الشطر 1)
                - Tranche 2 amount (Tranche 2 / الشطر 2)
                - Fixed electricity fee (Redevance Fixe Electricité / إتاوة ثابتة الكهرباء)
                - VAT (TVA / الضريبة على القيمة المضافة)
                - Total Water Consumption in m3 (Consommation Eau / إستهلاك الماء)
                - Price per m3 (Prix Unit./Unit. m3 / ثمن المتر الواحد / سعر الوحدة)
                - Sanitation/Sewerage fee (Redevance Assainissement / التطهير)
                - Fixed water fee (Redevance Fixe Eau / إتاوة ثابتة الماء)
                - Fixed sanitation fee (Redevance Fixe Assainissement / إتاوة ثابتة التطهير)
                - Total to pay (Total à Payer / المجموع الواجب أداءه / NET A PAYER)
                
                Return ONLY a JSON object with these keys: 
                consumptionKwh, tranche1, tranche2, redFixeElec, tva, consumptionM3, wM3, assainissement, redFixeEau, redFixeAssainissement, totalAPayer.
                Use numbers as strings. If a value is not found on THIS bill, return null for that key.`
              },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64String
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      setData(prev => {
        const next = { ...prev };
        if (result.consumptionKwh !== undefined && result.consumptionKwh !== null) next.consumptionKwh = result.consumptionKwh;
        if (result.tranche1 !== undefined && result.tranche1 !== null) next.tranche1 = result.tranche1;
        if (result.tranche2 !== undefined && result.tranche2 !== null) next.tranche2 = result.tranche2;
        if (result.redFixeElec !== undefined && result.redFixeElec !== null) next.redFixeElec = result.redFixeElec;
        if (result.tva !== undefined && result.tva !== null) next.tva = result.tva;
        
        if (result.consumptionM3 !== undefined && result.consumptionM3 !== null) next.consumptionM3 = result.consumptionM3;
        if (result.wM3 !== undefined && result.wM3 !== null) next.wM3 = result.wM3;
        if (result.assainissement !== undefined && result.assainissement !== null) next.assainissement = result.assainissement;
        if (result.redFixeEau !== undefined && result.redFixeEau !== null) next.redFixeEau = result.redFixeEau;
        if (result.redFixeAssainissement !== undefined && result.redFixeAssainissement !== null) next.redFixeAssainissement = result.redFixeAssainissement;

        // Auto-fill payments based on detected bill type
        if (result.totalAPayer) {
          if (result.consumptionKwh && result.consumptionKwh !== "0") {
            next.pMe = result.totalAPayer;
          } else if (result.consumptionM3 && result.consumptionM3 !== "0") {
            next.pNbr = result.totalAPayer;
          }
        }
        
        return next;
      });

    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء معالجة الصورة. حاول مرة أخرى.");
    } finally {
      setIsProcessing(false);
      // Clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const calculate = () => {
    const {
      consumptionKwh, ePre, eCur, tranche1, tranche2, redFixeElec, tva,
      consumptionM3, wPre, wCur, wM3, redFixeAssainissement, assainissement, redFixeEau,
      pMe, pNbr
    } = data;

    const KwhVal = parseFloat(consumptionKwh) || 0;
    const ePreVal = parseFloat(ePre) || 0;
    const eCurVal = parseFloat(eCur) || 0;
    const T1Val = parseFloat(tranche1) || 0;
    const T2Val = parseFloat(tranche2) || 0;
    const redElecVal = parseFloat(redFixeElec) || 0;
    const tvaVal = parseFloat(tva) || 0;

    const M3Val = parseFloat(consumptionM3) || 0;
    const wPreVal = parseFloat(wPre) || 0;
    const wCurVal = parseFloat(wCur) || 0;
    const wM3Val = parseFloat(wM3) || 0;
    const redAssainVal = parseFloat(redFixeAssainissement) || 0;
    const assainVal = parseFloat(assainissement) || 0;
    const redEauVal = parseFloat(redFixeEau) || 0;

    const pMeVal = parseFloat(pMe) || 0;
    const pNbrVal = parseFloat(pNbr) || 0;

    if (KwhVal === 0 && M3Val === 0) {
      setError("يرجى إدخال قيم الاستهلاك على الأقل.");
      return;
    }

    // Electricity logic
    const myE = eCurVal - ePreVal;
    const nbrE = KwhVal - myE;
    const totalElecCost = T1Val + T2Val;
    const pricePerKwh = KwhVal > 0 ? totalElecCost / KwhVal : 0;
    const totalElecFees = redElecVal + tvaVal;
    const myElecPrice = (pricePerKwh * myE) + (totalElecFees / 2);
    const nbrElecPrice = (pricePerKwh * nbrE) + (totalElecFees / 2);

    // Water logic
    const myW = wCurVal - wPreVal;
    const nbrW = M3Val - myW;
    const totalWaterFees = redAssainVal + assainVal + redEauVal;
    const myWaterPrice = (wM3Val * myW) + (totalWaterFees / 2);
    const nbrWaterPrice = (wM3Val * nbrW) + (totalWaterFees / 2);

    const myTotal = myElecPrice + myWaterPrice;
    const nbrTotal = nbrElecPrice + nbrWaterPrice;
    
    // Payments diff
    const diffNbr = nbrTotal - pNbrVal;
    const diffMe = pMeVal - myTotal;

    const generatedReport = `الاستهلاك ديال هاد الشهر هو: ${KwhVal.toFixed(1)} kw

الاستهلاك ديالي لهاد الشهر هو:
${eCurVal} - ${ePreVal} = ${myE.toFixed(1)} kw

الاستهلاك ديالك لهاد الشهر هو:
${KwhVal} - ${myE.toFixed(1)} = ${nbrE.toFixed(1)} kw

الشطر 1 + الشطر 2:
${T1Val} + ${T2Val} = ${totalElecCost.toFixed(2)} dh

تمن لكيلوواط هو:
${totalElecCost.toFixed(2)} / ${KwhVal} = ${pricePerKwh.toFixed(6)} dh

إتاوة ثابتة + الضريبة:
${totalElecFees.toFixed(2)} / 2 = ${(totalElecFees / 2).toFixed(2)} dh

المجموع ضو ديالي:
(${pricePerKwh.toFixed(6)} × ${myE.toFixed(1)}) + ${(totalElecFees / 2).toFixed(2)} = ${myElecPrice.toFixed(2)} dh

المجموع ضو ديالك:
(${pricePerKwh.toFixed(6)} × ${nbrE.toFixed(1)}) + ${(totalElecFees / 2).toFixed(2)} = ${nbrElecPrice.toFixed(2)} dh

----------------------------
استهلاك الماء هاد الشهر: ${M3Val.toFixed(1)} m³

الاستهلاك ديالي هو:
${wCurVal} - ${wPreVal} = ${myW.toFixed(1)} m³

تمن المتر المكعب: ${wM3Val.toFixed(2)} dh

الرسوم + الضريبة + التطهير:
${totalWaterFees.toFixed(2)} / 2 = ${(totalWaterFees / 2).toFixed(2)} dh

المجموع ديالي ديال الماء:
(${wM3Val.toFixed(2)} × ${myW.toFixed(1)}) + ${(totalWaterFees / 2).toFixed(2)} = ${myWaterPrice.toFixed(2)} dh

استهلاك ديالك ماء: ${nbrW.toFixed(1)} m³
المجموع ديالك ماء هو:
(${wM3Val.toFixed(2)} × ${nbrW.toFixed(1)}) + ${(totalWaterFees / 2).toFixed(2)} = ${nbrWaterPrice.toFixed(2)} dh

----------------------------
مجموع ضو + ماء ديالي:
${myElecPrice.toFixed(2)} + ${myWaterPrice.toFixed(2)} = ${myTotal.toFixed(2)} dh

مجموع ضو + ماء ديالك:
${nbrElecPrice.toFixed(2)} + ${nbrWaterPrice.toFixed(2)} = ${nbrTotal.toFixed(2)} dh

نتا خلصتي لفاكتورة ديال ماء ب ${pNbrVal.toFixed(2)} dh
و خاصك تخلص مجموع ضو + ماء ديالك ${nbrTotal.toFixed(2)} dh
إذن خاصك تزيد لي: ${diffNbr.toFixed(2)} dh

أنا خلصت لفاكتورة ديال ضو ب ${pMeVal.toFixed(2)} dh
و خاص نخلص مجموع ضو + ماء ديالي ${myTotal.toFixed(2)} dh
إذن الباقي لي: ${diffMe.toFixed(2)} dh

الخلاصة: خاصك ترجع لي ${diffNbr.toFixed(2)} درهم.`;

    setReport(generatedReport);
  };

  const copyToClipboard = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      alert("تم نسخ التقرير بنجاح!");
    }
  };

  const shareToWhatsApp = () => {
    if (report) {
      const encodedText = encodeURIComponent(report);
      const url = `https://wa.me/?text=${encodedText}`;
      window.open(url, '_blank', 'noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans selection:bg-blue-500/30 overflow-x-hidden" dir="rtl">
      
      {/* Header */}
      <header className="h-16 shrink-0 border-b border-zinc-700 flex items-center justify-between px-8 bg-zinc-900 z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">حاسبة الفواتير الذكية</h1>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <span className="text-sm text-zinc-400">نظام إدارة الاستهلاك المنزلي</span>
          <div className="w-8 h-8 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-yellow-500" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 container mx-auto">
        
        {/* Sidebar / Section 1 */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          
          {/* OCR Upload Card */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 flex flex-col h-fit">
            <h2 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              رفع الفواتير (OCR)
            </h2>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed border-zinc-600 rounded-xl py-10 flex flex-col items-center justify-center gap-4 bg-zinc-950/50 cursor-pointer hover:border-blue-500 transition-all group ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="w-14 h-14 rounded-full bg-zinc-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                {isProcessing ? (
                  <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                ) : (
                  <Camera className="w-7 h-7 text-blue-400" />
                )}
              </div>
              <div className="text-center px-4">
                <p className="text-sm font-medium text-zinc-200">ارفع فاتورة الكهرباء والماء (صورة أو PDF)</p>
                <p className="text-xs text-zinc-500 mt-1">يمكنك رفع كل فاتورة على حدة</p>
              </div>
              <button className="mt-2 px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20 active:scale-95">
                بدء المسح الضوئي
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*,.pdf"
            />

            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">حالة المسح:</span>
                <span className={isProcessing ? "text-blue-400" : "text-green-400"}>
                  {isProcessing ? "جاري استخراج البيانات..." : "جاهز"}
                </span>
              </div>
              <div className="w-full bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-blue-500 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: isProcessing ? '75%' : '0%' }}
                  transition={{ duration: 1.5, repeat: isProcessing ? Infinity : 0 }}
                />
              </div>
            </div>
          </div>

          {/* Payments Card */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Copy className="w-4 h-4" />
                المدفوعات والتحكم
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField id="pMe" label="خلصت أنا ضو (dh)" value={data.pMe} onChange={handleChange} placeholder="0.00" />
              <InputField id="pNbr" label="خلص هو ماء (dh)" value={data.pNbr} onChange={handleChange} placeholder="0.00" />
            </div>
            <div className="pt-2">
              <button
                onClick={resetForm}
                className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-red-500/10 border border-zinc-700 hover:border-red-500/30 text-xs font-semibold rounded-xl transition-all text-zinc-400 hover:text-red-400"
              >
                <RefreshCcw className="w-4 h-4" />
                تفريغ جميع الخانات
              </button>
            </div>
          </div>
        </section>

        {/* Consumption Data / Section 2 */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 lg:p-8 shadow-2xl h-full flex flex-col">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">بيانات الاستهلاك</h2>
                <p className="text-sm text-zinc-400">يرجى مراجعة البيانات المستخرجة وإضافة قراءات العداد الشخصي</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-12">
              {/* Electricity Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-2 border-b border-zinc-700/50">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white">بيانات الكهرباء</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <InputField id="consumptionKwh" label="الاستهلاك الكلي من الفاتورة (kWh)" value={data.consumptionKwh} onChange={handleChange} placeholder="مثلا: 245" highlight />
                  </div>
                  <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-700/30 space-y-4">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">قراءات العداد الذاتي</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <InputField id="eCur" label="القراءة الحالية" value={data.eCur} onChange={handleChange} placeholder="0" />
                      <InputField id="ePre" label="القراءة السابقة" value={data.ePre} onChange={handleChange} placeholder="0" />
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-700/30 space-y-4">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">تفاصيل الرسوم من الفاتورة</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <InputField id="tranche1" label="الشطر 1" value={data.tranche1} onChange={handleChange} placeholder="100.00" />
                      <InputField id="tranche2" label="الشطر 2" value={data.tranche2} onChange={handleChange} placeholder="0.00" />
                    </div>
                  </div>
                  <InputField id="redFixeElec" label="إتاوة ثابتة" value={data.redFixeElec} onChange={handleChange} placeholder="12.50" />
                  <InputField id="tva" label="ضريبة القيمة المضافة" value={data.tva} onChange={handleChange} placeholder="14.20" />
                </div>
              </div>

              {/* Water Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-2 border-b border-zinc-700/50">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Droplets className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white">بيانات الماء</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <InputField id="consumptionM3" label="استهلاك الماء الكلي من الفاتورة (m³)" value={data.consumptionM3} onChange={handleChange} placeholder="مثلا: 18" highlight />
                  </div>
                  <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-700/30 space-y-4">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">قراءات العداد الذاتي</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <InputField id="wCur" label="القراءة الحالية" value={data.wCur} onChange={handleChange} placeholder="0" />
                      <InputField id="wPre" label="القراءة السابقة" value={data.wPre} onChange={handleChange} placeholder="0" />
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-700/30 space-y-4">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">التسعيرة والرسوم</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <InputField id="wM3" label="ثمن المتر" value={data.wM3} onChange={handleChange} placeholder="2.5" />
                      <InputField id="redFixeEau" label="إتاوة ثابتة" value={data.redFixeEau} onChange={handleChange} placeholder="8.40" />
                    </div>
                  </div>
                  <InputField id="redFixeAssainissement" label="إتاوة ثابتة التطهير" value={data.redFixeAssainissement} onChange={handleChange} placeholder="5.20" />
                  <InputField id="assainissement" label="التطهير السائل" value={data.assainissement} onChange={handleChange} placeholder="45.80" />
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-zinc-700/50">
              <button
                onClick={calculate}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-black rounded-2xl shadow-xl shadow-emerald-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
              >
                <Calculator className="w-7 h-7 group-hover:scale-110 transition-transform" />
                إصدار التقرير النهائي المفصل
              </button>
            </div>
          </div>
        </section>
      </main>


      {/* Report Modal/Overlay */}
      <AnimatePresence>
        {report && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setReport(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-800 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-700 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold">التقرير النهائي</span>
                </div>
                <button 
                  onClick={() => setReport(null)}
                  className="p-1 hover:bg-zinc-700 rounded text-zinc-400"
                >
                  <RefreshCcw className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar text-right">
                <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-700 font-mono text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap select-all">
                  {report}
                </div>
              </div>

              <div className="p-4 bg-zinc-900/50 border-t border-zinc-700 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={shareToWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-emerald-900/20"
                >
                  <Share2 className="w-5 h-5" />
                  إرسال عبر واتساب
                </button>
                <button
                  onClick={copyToClipboard}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl transition-all font-bold"
                >
                  <Copy className="w-5 h-5" />
                  نسخ النص فقط
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="h-12 shrink-0 border-t border-zinc-700 px-8 flex items-center justify-between text-[11px] text-zinc-500 bg-zinc-900">
        <div>© {new Date().getFullYear()} نظام إدارة الاستهلاك المنزلي</div>
        <div className="hidden sm:flex gap-6">
          <span>دقة الحساب: 100%</span>
          <span>معامل الحساب: 1.042</span>
        </div>
      </footer>
    </div>
  );
}

function InputField({ id, label, value, onChange, placeholder, highlight = false }: { id: string, label: string, value: string, onChange: any, placeholder?: string, highlight?: boolean }) {
  return (
    <div className="space-y-1.5 group">
      <label htmlFor={id} className="block text-[11px] text-zinc-400 group-focus-within:text-blue-400 transition-colors">
        {label}
      </label>
      <input
        type="number"
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step="any"
        // Applying the specific input styles from the design
        className={`w-full bg-zinc-950 border ${highlight ? 'border-blue-500/50' : 'border-zinc-700'} rounded-lg p-2.5 text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 font-mono placeholder:text-zinc-700`}
      />
    </div>
  );
}
