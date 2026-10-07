import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';

const API = '/api/certificate';

function drawCertificatePDF(data) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;

  doc.setFillColor(11, 15, 26);
  doc.rect(0, 0, W, H, 'F');

  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(1.5);
  doc.roundedRect(8, 8, W - 16, H - 16, 4, 4, 'S');

  doc.setDrawColor(55, 65, 81);
  doc.setLineWidth(0.3);
  doc.roundedRect(12, 12, W - 24, H - 24, 3, 3, 'S');

  const accentSize = 18;
  doc.setDrawColor(139, 92, 246);
  doc.setLineWidth(0.8);
  [[14, 14, 1, 1], [W - 14, 14, -1, 1], [14, H - 14, 1, -1], [W - 14, H - 14, -1, -1]].forEach(([x, y, dx, dy]) => {
    doc.line(x, y, x + accentSize * dx, y);
    doc.line(x, y, x, y + accentSize * dy);
  });

  const cx = W / 2;

  doc.setFillColor(99, 102, 241);
  doc.circle(cx, 36, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('DSA', cx, 38.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(156, 163, 175);
  doc.text('CERTIFICATE OF COMPLETION', cx, 56, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text('Adaptive AI DSA Learning', cx, 70, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(139, 92, 246);
  doc.text('Data Structures & Algorithms Mastery', cx, 80, { align: 'center' });

  doc.setDrawColor(75, 85, 99);
  doc.setLineWidth(0.2);
  doc.line(cx - 70, 87, cx + 70, 87);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(156, 163, 175);
  doc.text('This certificate is proudly presented to', cx, 97, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(129, 140, 248);
  doc.text(data.user_name, cx, 115, { align: 'center' });

  const nameWidth = doc.getTextWidth(data.user_name);
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.5);
  doc.line(cx - nameWidth / 2 - 8, 119, cx + nameWidth / 2 + 8, 119);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(209, 213, 219);
  doc.text(
    'For successfully completing all learning phases and demonstrating',
    cx, 132, { align: 'center' }
  );
  doc.text(
    'proficiency in Data Structures & Algorithms',
    cx, 140, { align: 'center' }
  );

  doc.setDrawColor(75, 85, 99);
  doc.setLineWidth(0.2);
  doc.line(cx - 80, 152, cx + 80, 152);

  const completionDate = data.completion_date
    ? new Date(data.completion_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text('Date of Completion', cx - 55, 162, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(209, 213, 219);
  doc.text(completionDate, cx - 55, 170, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text('Certificate ID', cx + 55, 162, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(209, 213, 219);
  doc.text(data.certificate_id, cx + 55, 170, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text('Adaptive AI DSA Learning Platform — Powered by AI-driven personalized education', cx, H - 14, { align: 'center' });

  return doc;
}

export default function Certificate() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  useEffect(() => {
    if (!token) return;
    fetch(API, { headers: headers() })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Complete all phases to unlock your certificate.' : 'Failed to load certificate data.');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, headers]);

  const handleDownload = () => {
    if (!data) return;
    setDownloading(true);
    try {
      const doc = drawCertificatePDF(data);
      doc.save(`DSA_Certificate_${data.user_name.replace(/\s+/g, '_')}.pdf`);
    } catch {
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading certificate...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400">{error}</p>
          <button onClick={() => navigate('/learning')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors">
            Back to Learning
          </button>
        </div>
      </div>
    );
  }

  const completionDate = data.completion_date
    ? new Date(data.completion_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your Certificate</h1>
            <p className="text-gray-400 text-sm mt-1">Download your achievement certificate</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {downloading ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={() => navigate('/learning')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
              Back
            </button>
          </div>
        </div>

        {/* Certificate Preview Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0f1629] to-[#0b0f1a] border border-indigo-500/30 rounded-2xl p-1">
          <div className="border border-gray-700/50 rounded-xl p-8 relative">
            {/* Corner decorations */}
            <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-purple-500/60 rounded-tl-sm" />
            <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-purple-500/60 rounded-tr-sm" />
            <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-purple-500/60 rounded-bl-sm" />
            <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-purple-500/60 rounded-br-sm" />

            <div className="text-center space-y-6 py-6">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>

              {/* Title */}
              <div>
                <p className="text-xs tracking-[0.3em] text-gray-500 uppercase mb-2">Certificate of Completion</p>
                <h2 className="text-2xl font-bold text-white">Adaptive AI DSA Learning</h2>
                <p className="text-indigo-400 font-medium mt-1">Data Structures & Algorithms Mastery</p>
              </div>

              <div className="w-24 h-px bg-gray-700 mx-auto" />

              {/* Presented to */}
              <div>
                <p className="text-sm text-gray-400 mb-2">This certificate is proudly presented to</p>
                <h3 className="text-3xl font-bold text-indigo-300">{data.user_name}</h3>
              </div>

              {/* Achievement */}
              <div className="max-w-lg mx-auto">
                <p className="text-sm text-gray-300 leading-relaxed">
                  For successfully completing all learning phases and demonstrating
                  proficiency in Data Structures & Algorithms
                </p>
              </div>

              <div className="w-32 h-px bg-gray-700 mx-auto" />

              {/* Footer info */}
              <div className="flex justify-center gap-16 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Date of Completion</p>
                  <p className="text-gray-300 font-medium">{completionDate}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Certificate ID</p>
                  <p className="text-gray-300 font-medium font-mono">{data.certificate_id}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
