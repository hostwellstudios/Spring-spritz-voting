// PDF export — loaded lazily via dynamic script injection.
// Only triggered when admin clicks "Download PDF" on the results screen.

const PdfExport = (() => {
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

  const CATEGORIES  = ['taste', 'creativity', 'presentation'];
  const CAT_LABELS  = { taste: 'Taste', creativity: 'Creativity', presentation: 'Presentation' };
  const MEDALS_TEXT = ['1st', '2nd', '3rd'];

  function loadJsPdf() {
    return new Promise((resolve, reject) => {
      if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
      const script  = document.createElement('script');
      script.src    = JSPDF_CDN;
      script.onload = () => resolve(window.jspdf.jsPDF);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function generate(computed) {
    if (!computed) {
      showToast('Results not loaded yet', 'error');
      return;
    }

    const btn = document.getElementById('pdf-download-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating PDF…'; }

    try {
      const JsPDF = await loadJsPdf();
      const doc   = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      const { scores, rankedByCategory, rankedOverall, sharedNotes } = computed;
      const drinkMap = Object.fromEntries(State.drinks.map(d => [d.id, d]));

      // notesByDrink
      const notesByDrink = {};
      sharedNotes.forEach(n => {
        if (!notesByDrink[n.drink_id]) notesByDrink[n.drink_id] = [];
        if (n.note_text.trim()) notesByDrink[n.drink_id].push(n.note_text.trim());
      });

      const W  = 210;   // A4 width mm
      const ML = 18;    // left margin
      const MR = 18;    // right margin
      const CW = W - ML - MR;
      const PAGE_H = 297;
      const MB_BOTTOM = 20;

      let y = 0;

      function newPage() {
        doc.addPage();
        y = 20;
      }

      function checkY(needed) {
        if (y + needed > PAGE_H - MB_BOTTOM) newPage();
      }

      // ── Cover page ──────────────────────────────────────────
      y = 60;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.text('Spritz Competition', W / 2, y, { align: 'center' });

      y += 14;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text('Results & Tasting Notes', W / 2, y, { align: 'center' });

      y += 8;
      doc.setFontSize(11);
      doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), W / 2, y, { align: 'center' });

      doc.setTextColor(0);

      // ── Podium summary pages ─────────────────────────────────
      const allPodiums = [
        ...CATEGORIES.map(cat => ({ label: CAT_LABELS[cat], ranked: rankedByCategory[cat] })),
        { label: 'Overall', ranked: rankedOverall },
      ];

      allPodiums.forEach(({ label, ranked }) => {
        newPage();
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(label + ' — Top 3', ML, y);
        y += 10;

        doc.setFont('helvetica', 'normal');
        ranked.slice(0, 3).forEach((e, i) => {
          const d = drinkMap[e.id];
          if (!d) return;

          checkY(20);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`${MEDALS_TEXT[i]}  ${d.name}`, ML + 4, y);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(100);
          if (d.team_members.length) {
            doc.text(d.team_members.join(', '), ML + 8, y + 5);
            y += 5;
          }
          doc.setTextColor(180, 80, 20);
          doc.text(`${e.pts} pts`, W - MR, y, { align: 'right' });
          doc.setTextColor(0);
          y += 12;
        });
      });

      // ── Per-drink detail pages ───────────────────────────────
      newPage();
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('All Drinks — Detailed Scores', ML, y);
      y += 12;

      rankedOverall.forEach((e) => {
        const d = drinkMap[e.id];
        if (!d) return;

        checkY(40);

        // Drink header
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(d.name, ML, y);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        const teamStr = d.team_members.length ? d.team_members.join(', ') : 'No team listed';
        doc.text(teamStr, ML, y + 5);
        doc.setTextColor(180, 80, 20);
        doc.text(`Overall #${e.rank}  |  ${e.pts} pts total`, W - MR, y, { align: 'right' });
        doc.setTextColor(0);
        y += 10;

        // Category scores
        doc.setFontSize(9);
        CATEGORIES.forEach(cat => {
          const pts = scores.perCategory[cat][d.id] || 0;
          const catRanked = rankedByCategory[cat];
          const catEntry  = catRanked.find(x => x.id === d.id);
          const catRank   = catEntry?.rank || '—';
          doc.text(`${CAT_LABELS[cat]}: ${pts} pts (rank #${catRank})`, ML + 4, y);
          y += 5;
        });

        // Shared notes
        const notes = notesByDrink[d.id] || [];
        if (notes.length) {
          y += 3;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(80);
          notes.forEach(note => {
            const lines = doc.splitTextToSize(`"${note}"`, CW - 8);
            checkY(lines.length * 5 + 4);
            doc.text(lines, ML + 4, y);
            y += lines.length * 5 + 3;
          });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0);
        }

        y += 8;

        // Divider
        checkY(4);
        doc.setDrawColor(220);
        doc.line(ML, y, W - MR, y);
        doc.setDrawColor(0);
        y += 6;
      });

      doc.save('spritz-competition-results.pdf');
      showToast('PDF downloaded ✓', 'success');

    } catch (err) {
      console.error(err);
      showToast('PDF generation failed', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Download PDF'; }
    }
  }

  return { generate };
})();
