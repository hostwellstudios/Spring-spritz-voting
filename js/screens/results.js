const Results = (() => {
  const CATEGORIES = ['taste', 'creativity', 'presentation'];
  const CAT_LABELS = { taste: 'Taste', creativity: 'Creativity', presentation: 'Presentation' };
  const CAT_ICONS  = { taste: '👅', creativity: '🎨', presentation: '✨' };
  const MEDALS = ['🥇', '🥈', '🥉'];

  // ----------------------------------------------------------------
  // Score calculation
  // ----------------------------------------------------------------

  function calculateScores(votes) {
    // votes: array of { drink_id, category, rank }
    // Scoring: reverse rank — if N drinks, rank 1 → N pts, rank N → 1 pt
    // N = number of unique drinks that received votes in that category

    const perCategory = {}; // { category: { drinkId: totalPoints } }
    CATEGORIES.forEach(cat => { perCategory[cat] = {}; });

    // Group by category, find N per category
    const byCategory = {};
    CATEGORIES.forEach(cat => { byCategory[cat] = []; });
    votes.forEach(v => {
      if (byCategory[v.category]) byCategory[v.category].push(v);
    });

    CATEGORIES.forEach(cat => {
      const catVotes = byCategory[cat];
      if (catVotes.length === 0) return;

      // N = number of distinct drinks ranked in this category
      const drinkIds = [...new Set(catVotes.map(v => v.drink_id))];
      const N        = drinkIds.length;

      catVotes.forEach(v => {
        const pts = N - v.rank + 1;  // rank 1 → N pts; rank N → 1 pt
        if (!perCategory[cat][v.drink_id]) perCategory[cat][v.drink_id] = 0;
        perCategory[cat][v.drink_id] += pts;
      });
    });

    // Overall = sum across all categories
    const overall = {};
    State.drinks.forEach(d => { overall[d.id] = 0; });
    CATEGORIES.forEach(cat => {
      Object.entries(perCategory[cat]).forEach(([id, pts]) => {
        if (overall[id] === undefined) overall[id] = 0;
        overall[id] += pts;
      });
    });

    return { perCategory, overall };
  }

  function rankDrinks(scoreMap) {
    // Returns drinks sorted by score desc, with their rank (1-based)
    const entries = Object.entries(scoreMap)
      .map(([id, pts]) => ({ id, pts }))
      .sort((a, b) => b.pts - a.pts);

    // Handle ties: same score → same rank
    let rank = 1;
    return entries.map((e, i) => {
      if (i > 0 && e.pts < entries[i - 1].pts) rank = i + 1;
      return { ...e, rank };
    });
  }

  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------

  function medalForRank(rank) {
    return MEDALS[rank - 1] || null;
  }

  function renderPodiumSection(title, rankedDrinks) {
    const drinkMap = Object.fromEntries(State.drinks.map(d => [d.id, d]));
    // Include all drinks that placed 1st, 2nd, or 3rd (ties expand the podium)
    const top = rankedDrinks.filter(e => e.rank <= 3);

    return `
      <div class="results-section">
        <h2>${title}</h2>
        <div class="podium">
          ${top.map(e => {
            const d = drinkMap[e.id];
            if (!d) return '';
            const medal     = medalForRank(e.rank);
            const goldClass = e.rank === 1 ? ' podium-item--gold' : '';
            return `
              <div class="podium-item${goldClass}">
                <div class="podium-medal">${medal ?? e.rank}</div>
                <div>
                  <div class="podium-drink-name">${escapeHtml(d.name)}</div>
                  <div class="podium-drink-team">${escapeHtml(d.team_members.join(', '))}</div>
                </div>
                <div class="podium-score">${e.pts} pts</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderDrinkBreakdown(scores, sharedNotes) {
    const { perCategory, overall } = scores;
    const rankedOverall = rankDrinks(overall);
    const drinkMap      = Object.fromEntries(State.drinks.map(d => [d.id, d]));

    const sorted = rankedOverall.map(e => drinkMap[e.id]).filter(Boolean);

    const notesByDrink = {};
    sharedNotes.forEach(n => {
      if (!notesByDrink[n.drink_id]) notesByDrink[n.drink_id] = [];
      if (n.note_text.trim()) notesByDrink[n.drink_id].push(n.note_text.trim());
    });

    const cards = sorted.map(d => {
      const overallEntry = rankedOverall.find(e => e.id === d.id);
      const overallPts   = overallEntry?.pts || 0;
      const overallRank  = overallEntry?.rank ?? null;
      const medal        = overallRank !== null ? medalForRank(overallRank) : null;

      const catChips = CATEGORIES.map(cat => {
        const pts = perCategory[cat][d.id] || 0;
        return `<span class="category-score-chip">${CAT_ICONS[cat]} ${CAT_LABELS[cat]}: ${pts}</span>`;
      }).join('');

      const notes    = notesByDrink[d.id] || [];
      const noteHtml = notes.length
        ? `<div class="results-notes">${notes.map(n => `<div class="results-note-item">"${escapeHtml(n)}"</div>`).join('')}</div>`
        : '';

      return `
        <div class="results-drink-card">
          <div class="results-drink-header">
            <div>
              <div class="results-drink-name">${medal ? medal + ' ' : ''}${escapeHtml(d.name)}</div>
              <div class="results-overall-rank">Overall #${overallRank ?? '—'} — ${overallPts} pts total</div>
            </div>
          </div>
          <div class="results-category-scores">${catChips}</div>
          ${noteHtml}
        </div>
      `;
    }).join('');

    return `<div class="results-section"><h2>All Drinks</h2>${cards}</div>`;
  }

  // Stored after each successful load so downloadAsImage can use it
  let _computed = null;

  // ----------------------------------------------------------------
  // Main load function — fetches votes + notes and renders
  // ----------------------------------------------------------------

  async function load() {
    const container = document.getElementById('results-content');
    if (!container) return;

    container.innerHTML = '<p class="subtitle">Calculating scores…</p>';

    try {
      const [votes, sharedNotes] = await Promise.all([
        fetchAllVotes(),
        fetchSharedNotes(),
      ]);

      if (votes.length === 0) {
        container.innerHTML = '<p class="subtitle">No votes yet — check back shortly.</p>';
        return;
      }

      const scores = calculateScores(votes);

      const rankedByCategory = {};
      CATEGORIES.forEach(cat => {
        rankedByCategory[cat] = rankDrinks(scores.perCategory[cat]);
      });
      const rankedOverall = rankDrinks(scores.overall);
      _computed = { scores, rankedByCategory, rankedOverall };

      let html = '';
      CATEGORIES.forEach(cat => {
        html += renderPodiumSection(`${CAT_ICONS[cat]} ${CAT_LABELS[cat]}`, rankedByCategory[cat]);
      });
      html += renderPodiumSection('🏆 Overall', rankedOverall);
      html += renderDrinkBreakdown(scores, sharedNotes);

      container.innerHTML = html;

      // Show image download button once results are shared (visible to everyone)
      const downloadSection = document.getElementById('results-download-section');
      if (downloadSection) downloadSection.hidden = !State.resultsShared;

    } catch (err) {
      console.error(err);
      container.innerHTML = '<p style="color:var(--color-error)">Error loading results.</p>';
    }
  }

  // ----------------------------------------------------------------
  // Image download via html2canvas
  // ----------------------------------------------------------------

  const HTML2CANVAS_CDN = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';

  function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (window.html2canvas) { resolve(window.html2canvas); return; }
      const script   = document.createElement('script');
      script.src     = HTML2CANVAS_CDN;
      script.onload  = () => resolve(window.html2canvas);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function buildSummaryEl() {
    const { scores, rankedByCategory, rankedOverall } = _computed;
    const drinkMap = Object.fromEntries(State.drinks.map(d => [d.id, d]));

    const C = {
      bg:      '#FAE0D6',
      surface: '#FEF3EE',
      border:  '#E5C0B3',
      primary: '#C8543F',
      text:    '#3D1A10',
      muted:   '#A06A58',
    };

    const overallWinners = rankedOverall.filter(e => e.rank === 1);
    const topPts         = overallWinners[0]?.pts || 0;

    const winnerNamesHtml = overallWinners.map(e => {
      const d = drinkMap[e.id];
      if (!d) return '';
      return `
        <div style="font-family:'Amarante',Georgia,serif;font-size:22px;color:${C.text};line-height:1.2;margin-bottom:2px">${escapeHtml(d.name)}</div>
        ${d.team_members.length ? `<div style="font-size:12px;color:${C.muted};margin-bottom:6px">${escapeHtml(d.team_members.join(', '))}</div>` : ''}
      `;
    }).join('');

    const catBoxes = CATEGORIES.map(cat => {
      const winners = rankedByCategory[cat].filter(e => e.rank === 1);
      const names   = winners.map(e => escapeHtml(drinkMap[e.id]?.name || '')).filter(Boolean).join(', ');
      return `
        <div style="background:${C.surface};border-radius:8px;padding:10px 8px;text-align:center;flex:1;min-width:0;border:1px solid ${C.border}">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:${C.muted};margin-bottom:3px">${CAT_ICONS[cat]} ${CAT_LABELS[cat]}</div>
          <div style="font-size:20px;line-height:1.4">🥇</div>
          <div style="font-size:11px;font-weight:600;color:${C.text};line-height:1.3">${names}</div>
        </div>`;
    }).join('');

    const rankRows = rankedOverall.map(e => {
      const d = drinkMap[e.id];
      if (!d) return '';
      const medal = medalForRank(e.rank);
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid ${C.border}">
          <span style="width:26px;text-align:center;font-size:14px;flex-shrink:0">${medal ?? ''}</span>
          <span style="flex:1;color:${C.text};font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.name)}</span>
          <span style="color:${C.muted};font-size:12px;flex-shrink:0">${e.pts} pts</span>
        </div>`;
    }).join('');

    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:-9999px;top:0;width:390px;background:${C.bg};font-family:'DM Sans',system-ui,sans-serif;padding:32px 24px;box-sizing:border-box`;

    el.innerHTML = `
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-family:'Amarante',Georgia,serif;font-size:34px;color:${C.primary};line-height:1.1">Spring Spritz</div>
        <div style="font-family:'Amarante',Georgia,serif;font-size:18px;color:${C.muted};line-height:1.5">2026</div>
        <div style="font-size:11px;color:${C.muted};margin-top:4px">${date}</div>
      </div>

      <div style="background:${C.surface};border-radius:12px;padding:20px;text-align:center;margin-bottom:16px;border:1.5px solid ${C.primary}">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.muted};margin-bottom:6px">Overall Winner</div>
        <div style="font-size:40px;line-height:1.3;margin-bottom:6px">🥇</div>
        ${winnerNamesHtml}
        <div style="font-size:15px;color:${C.primary};font-weight:700;margin-top:4px">${topPts} pts</div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:20px">${catBoxes}</div>

      <div>
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:${C.muted};margin-bottom:8px">Full Rankings</div>
        ${rankRows}
      </div>

      <div style="text-align:center;margin-top:16px;font-size:11px;color:${C.muted}">🍹 Spring Spritz 2026</div>
    `;

    return el;
  }

  async function downloadAsImage() {
    const btn = document.getElementById('image-download-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Capturing…'; }

    if (!_computed) {
      showToast('Results not loaded yet', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '📸 Save as Image'; }
      return;
    }

    let summaryEl = null;
    try {
      const html2canvas = await loadHtml2Canvas();
      summaryEl = buildSummaryEl();
      document.body.appendChild(summaryEl);

      await new Promise(r => requestAnimationFrame(r));

      const canvas = await html2canvas(summaryEl, {
        backgroundColor: '#FAE0D6',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const link    = document.createElement('a');
      link.download = 'spring-spritz-2026-results.png';
      link.href     = canvas.toDataURL('image/png');
      link.click();
      showToast('Image saved ✓', 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not save image', 'error');
    } finally {
      if (summaryEl) summaryEl.remove();
      if (btn) { btn.disabled = false; btn.textContent = '📸 Save as Image'; }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const imageBtn = document.getElementById('image-download-btn');
    if (imageBtn) {
      imageBtn.addEventListener('click', downloadAsImage);
    }
  });

  return { load };
})();
