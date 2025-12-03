import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { FiUpload, FiDownload, FiCheck, FiAlertCircle, FiX } from 'react-icons/fi';
import { supabase } from '../../supabaseClient';
import { useFarmId } from '../../hooks/useFarmId';

const ExcelImportModal = ({ isOpen, onClose, onSuccess, groups }) => {
  const { farmId } = useFarmId();
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Küpe No': 'TR123456789',
        'Doğum Tarihi': '01.01.2023',
        'Alış Fiyatı': 15000,
        'Kilo': 250,
        'Grup': 1
      },
      {
        'Küpe No': 'TR987654321',
        'Doğum Tarihi': '15.05.2023',
        'Alış Fiyatı': 16500,
        'Kilo': 280,
        'Grup': 2
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hayvanlar");
    XLSX.writeFile(wb, "Hayvan_Yukleme_Sablonu.xlsx");
  };

  const parseDate = (excelDate) => {
    if (!excelDate) return null;
    
    // Handle Excel serial date
    if (typeof excelDate === 'number') {
      const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    
    // Handle string formats
    if (typeof excelDate === 'string') {
        // DD.MM.YYYY
        if (excelDate.includes('.')) {
            const parts = excelDate.split('.');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        // YYYY-MM-DD
        if (excelDate.includes('-')) {
            return excelDate;
        }
    }
    
    return null;
  };

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
            setError('Dosya boş veya uygun formatta değil.');
            setLoading(false);
            return;
        }

        // Validate and format data
        const formattedData = data.map((row, index) => {
            const tagNumber = row['Küpe No'] ? String(row['Küpe No']).trim() : null;
            const birthDate = parseDate(row['Doğum Tarihi']);
            const purchasePrice = parseFloat(row['Alış Fiyatı']) || 0;
            const weight = parseFloat(row['Kilo']) || 0;
            const groupId = row['Grup'] ? parseInt(row['Grup']) : null;

            let status = 'valid';
            let message = '';

            if (!tagNumber) {
                status = 'error';
                message = 'Küpe No eksik';
            }

            return {
                id: index,
                tag_number: tagNumber,
                birth_date: birthDate,
                purchase_price: purchasePrice,
                current_weight: weight,
                group_id: groupId,
                status,
                message
            };
        });

        setPreviewData(formattedData);
      } catch (err) {
        console.error("Excel parse error:", err);
        setError('Dosya okunurken bir hata oluştu. Lütfen şablonu kontrol edin.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImport = async () => {
    if (!farmId) {
        setError('Çiftlik bilgisi bulunamadı.');
        return;
    }

    const validRecords = previewData.filter(d => d.status === 'valid');
    if (validRecords.length === 0) {
        setError('Yüklenecek geçerli kayıt bulunamadı.');
        return;
    }

    setLoading(true);
    try {
        const recordsToInsert = validRecords.map(r => ({
            farm_id: farmId,
            tag_number: r.tag_number,
            birth_date: r.birth_date,
            purchase_price: r.purchase_price,
            current_weight: r.current_weight,
            group_id: r.group_id
        }));

        const { error: insertError } = await supabase
            .from('animals')
            .insert(recordsToInsert);

        if (insertError) throw insertError;

        onSuccess(validRecords.length);
        onClose();
    } catch (err) {
        console.error("Import error:", err);
        setError('Veritabanına yükleme sırasında hata oluştu: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Excel'den Hayvan Yükle</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {!file ? (
            <div className="flex flex-col items-center justify-center space-y-6 py-10">
              <div className="text-center">
                <p className="text-gray-600 mb-2">Excel dosyanızı yükleyerek toplu hayvan girişi yapabilirsiniz.</p>
                <button 
                  onClick={handleDownloadTemplate}
                  className="text-green-600 hover:text-green-700 font-medium flex items-center justify-center gap-2 mx-auto"
                >
                  <FiDownload /> Örnek Şablonu İndir
                </button>
              </div>

              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-10 w-full max-w-md text-center cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FiUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 font-medium">Dosya Seçmek İçin Tıklayın</p>
                <p className="text-xs text-gray-500 mt-2">.xlsx veya .xls formatında</p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-gray-50 p-3 rounded border">
                <span className="font-medium text-gray-700">{file.name}</span>
                <button 
                  onClick={() => { setFile(null); setPreviewData([]); setError(null); }}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Dosyayı Kaldır
                </button>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded flex items-center gap-2">
                  <FiAlertCircle /> {error}
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Küpe No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Doğum Tarihi</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kilo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grup</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.map((row) => (
                      <tr key={row.id} className={row.status === 'error' ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {row.status === 'valid' ? (
                            <span className="text-green-600"><FiCheck /></span>
                          ) : (
                            <span className="text-red-600 text-xs">{row.message}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.tag_number}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row.birth_date || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row.current_weight}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{row.group_id || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="text-sm text-gray-500 text-right">
                Toplam {previewData.length} kayıt, {previewData.filter(d => d.status === 'valid').length} geçerli.
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
          >
            İptal
          </button>
          {file && (
            <button
              onClick={handleImport}
              disabled={loading || previewData.filter(d => d.status === 'valid').length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Yükleniyor...' : 'İçe Aktar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;
