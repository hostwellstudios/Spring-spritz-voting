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

  function renderPodium(rankedDrinks, category) {
    const drinkMap = Object.fromEntries(State.drinks.map(d => [d.id, d]));
    const top3     = rankedDrinks.slice(0, 3);

    return `
      <div class="results-section">
        <h2>${CAT_ICONS[category]} ${CAT_LABELS[category]}</h2>
        <div class="podium">
          ${top3.map((e, i) => {
            const d = drinkMap[e.id];
            if (!d) return '';
            return `
              <div class="podium-item">
                <div class="podium-medal">${MEDALS[i] || (i + 1)}</div>
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

  function renderOverall(rankedOverall) {
    const drinkMap = Object.fromEntries(State.drinks.map(d => [d.id, d]));
    const top3     = rankedOverall.slice(0, 3);

    return `
      <div class="results-section">
        <h2>🏆 Overall</h2>
        <div class="podium">
          ${top3.map((e, i) => {
            const d = drinkMap[e.id];
            if (!d) return '';
            return `
              <div class="podium-item">
                <div class="podium-medal">${MEDALS[i] || (i + 1)}</div>
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

    // Sort drinks by overall rank for the breakdown section
    const sorted = rankedOverall.map(e => drinkMap[e.id]).filter(Boolean);

    // notesByDrink: { drinkId: [noteText, ...] }
    const notesByDrink = {};
    sharedNotes.forEach(n => {
      if (!notesByDrink[n.drink_id]) notesByDrink[n.drink_id] = [];
      if (n.note_text.trim()) notesByDrink[n.drink_id].push(n.note_text.trim());
    });

    const cards = sorted.map((d, i) => {
      const overallEntry  = rankedOverall.find(e => e.id === d.id);
      const overallPts    = overallEntry?.pts || 0;
      const overallRank   = overallEntry?.rank || '—';

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
              <div class="results-drink-name">${MEDALS[i] ? MEDALS[i] + ' ' : ''}${escapeHtml(d.name)}</div>
              <div class="results-overall-rank">Overall #${overallRank} — ${overallPts} pts total</div>
            </div>
          </div>
          <div class="results-category-scores">${catChips}</div>
          ${noteHtml}
        </div>
      `;
    }).join('');

    return `<div class="results-section"><h2>All Drinks</h2>${cards}</div>`;
  }

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

      let html = '';
      CATEGORIES.forEach(cat => {
        html += renderPodium(rankedByCategory[cat], cat);
      });
      html += renderOverall(rankedOverall);
      html += renderDrinkBreakdown(scores, sharedNotes);

      container.innerHTML = html;

      // Show PDF button for admin
      const pdfSection = document.getElementById('admin-pdf-section');
      if (pdfSection) pdfSection.hidden = !State.isAdmin;

      // Store computed data for PDF export
      Results._computed = { scores, rankedByCategory, rankedOverall, sharedNotes };

    } catch (err) {
      console.error(err);
      container.innerHTML = '<p style="color:var(--color-error)">Error loading results.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const pdfBtn = document.getElementById('pdf-download-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => {
        PdfExport.generate(Results._computed);
      });
    }
  });

  return { load, _computed: null };
})();
