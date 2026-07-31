const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const defaults = {
  assessment: 'Mar-9 GA Extended Writing Task - Athletic Ability',
  teacher: 'Jasmine Ramey',
  grade: '4',
  section: 'A',
  student: '',
  raw: null,
  domain: '',
  skill: '',
};

let state = { ...defaults };
let data = { scores: [], skills: [] };
let sort = { key: 'raw_score', dir: -1 };

const ratingColors = {
  Strong: '#37a56b',
  Sufficient: '#61bd84',
  Partial: '#f6b91f',
  Weak: '#ff8247',
  Insufficient: '#d84257',
  Missing: '#9aa9ba',
};

const barColors = {
  0: '#d84257',
  1: '#d84257',
  2: '#f6b91f',
  3: '#f6b91f',
  4: '#40547e',
  5: '#59c68b',
  6: '#ff8247',
  7: '#6a6a6a',
  8: '#d84257',
};

function csv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

const unique = (values) => [...new Set(values.filter(Boolean))]
  .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

const escaped = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const submitted = (score) => (
  String(score.submission_status).toLowerCase() === 'submitted'
  && score.raw_score !== ''
  && score.raw_score != null
);

function sourceScores() {
  return data.scores.filter((score) => (
    score.assessment === defaults.assessment
    && score.teacher === defaults.teacher
  ));
}

function baseScores({ applyRaw = false } = {}) {
  return sourceScores().filter((score) => (
    (!state.grade || score.grade === state.grade)
    && (!state.section || score.section === state.section)
    && (!state.student || score.student_name === state.student)
    && (!applyRaw || state.raw === null || Number(score.raw_score) === state.raw)
  ));
}

function activeScores({ applyRaw = false } = {}) {
  return baseScores({ applyRaw }).filter(submitted);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function setSelectOptions(id, items, value, allLabel) {
  const select = $(id);
  select.innerHTML = '<option value="">' + allLabel + '</option>'
    + unique(items).map((item) => '<option value="' + escaped(item) + '">' + escaped(item) + '</option>').join('');
  select.value = value || '';
}

function setFilters() {
  const all = sourceScores();
  setSelectOptions('#gradeFilter', all.map((score) => score.grade), state.grade, 'All grades');

  const gradeScores = all.filter((score) => !state.grade || score.grade === state.grade);
  setSelectOptions('#sectionFilter', gradeScores.map((score) => score.section), state.section, 'All sections');

  const sectionScores = gradeScores.filter((score) => !state.section || score.section === state.section);
  setSelectOptions('#studentFilter', sectionScores.map((score) => score.student_name), state.student, 'All students');
}

function updateClearButtons() {
  $('#clearRawScore').hidden = state.raw === null;
  $('#clearDomain').hidden = !state.domain;
  $('#clearSkill').hidden = !state.skill;
}

function renderHeader() {
  const context = baseScores();
  const first = context[0] || {};
  const enrolled = context.length;
  const scored = context.filter(submitted).length;

  $('#schoolEyebrow').textContent = ((first.school_name || 'Write Score') + ' | WRITING ASSESSMENT').toUpperCase();
  $('#assessmentTitle').textContent = state.assessment || 'All Assessments';
  $('#assessmentMeta').textContent = (first.season || '') + ' | ' + (first.writing_type || 'Writing Rubric') + ' (0-8)';
  $('#classSummary').innerHTML = '<strong>Class Summary:</strong> ' + enrolled + ' students enrolled | ' + scored + ' scored submissions';
  $('#teacherName').textContent = state.teacher || 'All Teachers';
  $('#className').textContent = 'Grade ' + (state.grade || 'All') + ' | Section ' + (state.section || 'All');
}

function renderKpis() {
  const scores = activeScores();
  const count = (minimum, maximum) => scores.filter((score) => (
    Number(score.raw_score) >= minimum && Number(score.raw_score) <= maximum
  )).length;

  const cards = [
    ['Students Scored', scores.length, 'Submitted responses'],
    ['Advanced + Proficient', count(5, 8), 'Scores 5-8'],
    ['Developing', count(3, 4), 'Scores 3-4'],
    ['Beginning', count(1, 2), 'Scores 1-2'],
    ['No Evidence', count(0, 0), 'Raw score 0'],
  ];

  $('#kpiGrid').innerHTML = cards.map(([label, value, note]) => (
    '<article class="kpi"><p class="kpi-label">' + label + '</p><div class="kpi-value">' + value + '</div><p class="kpi-note">' + note + '</p></article>'
  )).join('');
}

function renderRaw() {
  const scores = activeScores();
  const buckets = unique(scores.map((score) => Number(score.raw_score))).map(Number);
  const counts = buckets.map((rawScore) => [rawScore, scores.filter((score) => Number(score.raw_score) === rawScore).length]);
  const maximum = Math.max(...counts.map(([, count]) => count), 1);

  $('#rawScoreChart').innerHTML = counts.length ? counts.map(([rawScore, count]) => (
    '<button class="raw-bar ' + (state.raw === rawScore ? 'active' : '') + '" data-score="' + rawScore + '" '
      + 'title="Raw score ' + rawScore + ': ' + count + ' student' + (count === 1 ? '' : 's') + '" '
      + 'aria-label="Raw score ' + rawScore + ': ' + count + ' student' + (count === 1 ? '' : 's') + '">'
      + '<span class="bar-count">' + count + '</span>'
      + '<span class="bar-fill" style="height:' + Math.max(5, (count / maximum) * 245) + 'px;background:' + barColors[rawScore] + '"></span>'
      + '<span class="bar-score">' + rawScore + '</span>'
      + '</button>'
  )).join('') : '<p class="chart-empty">No scored students match these filters.</p>';

  $$('.raw-bar').forEach((bar) => {
    bar.onclick = () => {
      const rawScore = Number(bar.dataset.score);
      state.raw = state.raw === rawScore ? null : rawScore;
      render();
      showToast(state.raw === null ? 'Score focus cleared' : 'Roster focused on raw score ' + state.raw);
      $('.roster-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
}

function renderDomains() {
  const scores = activeScores();
  const domains = [
    ['Purpose & Organization', 'purpose', 3, 'orange'],
    ['Evidence & Elaboration', 'evidence', 3, 'green'],
    ['Language Usage & Conventions', 'language', 2, 'navy'],
  ];

  $('#domainChart').innerHTML = domains.map(([name, key, maximum, color]) => {
    const value = average(scores.map((score) => Number(score[key])));
    return '<button class="domain-row ' + (state.domain === name ? 'active' : '') + '" data-domain="' + escaped(name) + '" '
      + 'title="Focus skill detail on ' + escaped(name) + '">'
      + '<span class="domain-name">' + name + '</span>'
      + '<span class="domain-track"><span class="domain-fill domain-' + color + '" style="width:' + ((value / maximum) * 100) + '%"></span></span>'
      + '<strong class="domain-value">' + value.toFixed(2) + ' / ' + maximum + '</strong>'
      + '</button>';
  }).join('');

  $$('.domain-row').forEach((row) => {
    row.onclick = () => {
      const domain = row.dataset.domain;
      state.raw = null;
      state.domain = state.domain === domain ? '' : domain;
      state.skill = '';
      render();
      showToast(state.domain ? 'Skill detail focused on ' + state.domain : 'Domain focus cleared');
      $('.skill-detail-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });

  const rawAverage = average(scores.map((score) => Number(score.raw_score)));
  $('#classAverageChart').innerHTML = '<div class="average-number">' + rawAverage.toFixed(2) + ' <small>/ 8</small></div>'
    + '<div class="average-track"><div class="average-fill" style="width:' + ((rawAverage / 8) * 100) + '%"></div></div>'
    + '<p class="average-caption">Average raw score for the students currently shown.</p>';
}

function renderResources() {
  const scores = activeScores();
  const groups = [
    {
      name: 'Purpose & Organization',
      key: 'purpose',
      maximum: 3,
      label: 'Focus area',
      links: ['Introductions: Build a Strong Opening', 'Progression and Transitions: Organize Ideas Clearly'],
    },
    {
      name: 'Evidence & Elaboration',
      key: 'evidence',
      maximum: 3,
      label: 'Focus area',
      links: ['Focus: Stay on Topic and Develop the Main Idea', 'Development of Support: Add Relevant Details'],
    },
    {
      name: 'Language Usage & Conventions',
      key: 'language',
      maximum: 2,
      label: 'Priority gap',
      links: ['Capitalization and Punctuation: Daily Editing Practice', 'Sentence Formation: Build Clear Complete Sentences'],
    },
  ];

  $('#resourceIntro').textContent = 'Targeted practice connected to current domain results.';
  $('#resourceList').innerHTML = groups.map((group) => {
    const value = average(scores.map((score) => Number(score[group.key])));
    return '<section class="resource-group"><h3>' + group.name + '</h3>'
      + '<p><strong>' + group.label + ':</strong> Average ' + value.toFixed(2) + ' / ' + group.maximum + '</p>'
      + group.links.map((link) => '<a href="https://www.writescore.com/" target="_blank" rel="noopener">' + link + '</a>').join('')
      + '</section>';
  }).join('');
}

function availableSkills({ applyRaw = false } = {}) {
  const ids = new Set(activeScores({ applyRaw }).map((score) => score.student_score_id));
  return data.skills.filter((skill) => ids.has(skill.student_score_id));
}

function renderSkills() {
  const skills = availableSkills();
  const ratings = ['Strong', 'Sufficient', 'Partial', 'Weak', 'Insufficient', 'Missing'];
  const domainOrder = ['Purpose & Organization', 'Evidence & Elaboration', 'Language Usage & Conventions'];
  const shownDomains = state.domain ? domainOrder.filter((domain) => domain === state.domain) : domainOrder;

  $('#skillLegend').innerHTML = ratings.map((rating) => (
    '<span class="legend-item"><i class="legend-swatch" style="background:' + ratingColors[rating] + '"></i>' + rating + '</span>'
  )).join('');

  let markup = '';
  shownDomains.forEach((domain) => {
    markup += '<div class="skill-group-title">' + domain + '</div>';
    unique(skills.filter((skill) => skill.domain === domain).map((skill) => skill.skill)).forEach((skillName) => {
      const rows = skills.filter((skill) => skill.domain === domain && skill.skill === skillName);
      const total = rows.length || 1;
      markup += '<button class="skill-row ' + (state.skill === skillName ? 'active' : '') + '" data-domain="' + escaped(domain) + '" data-skill="' + escaped(skillName) + '" '
        + 'title="Focus skill detail on ' + escaped(skillName) + '">'
        + '<span class="skill-name">' + skillName + '</span>'
        + '<span class="skill-stack">' + ratings.map((rating) => {
          const count = rows.filter((skill) => skill.rating === rating).length;
          return count ? '<span class="skill-segment" title="' + rating + ': ' + count + '" style="width:' + ((count / total) * 100) + '%;background:' + ratingColors[rating] + '"></span>' : '';
        }).join('') + '</span>'
        + '<span class="skill-total">' + rows.length + '</span>'
        + '</button>';
    });
  });

  $('#skillsChart').innerHTML = markup || '<p class="chart-empty">No skill ratings match these filters.</p>';
  $$('.skill-row').forEach((row) => {
    const domain = row.dataset.domain;
    const skillName = row.dataset.skill;
    const skillRows = skills.filter((skill) => skill.domain === domain && skill.skill === skillName);
    row.onmouseenter = (event) => showSkillTooltip(event, domain, skillName, skillRows);
    row.onmousemove = (event) => positionSkillTooltip(event);
    row.onmouseleave = hideSkillTooltip;
    row.onfocus = (event) => showSkillTooltip(event, domain, skillName, skillRows);
    row.onblur = hideSkillTooltip;
    row.onclick = () => {
      const domain = row.dataset.domain;
      const skill = row.dataset.skill;
      if (state.domain === domain && state.skill === skill) {
        state.skill = '';
      } else {
        state.raw = null;
        state.domain = domain;
        state.skill = skill;
      }
      render();
      showToast(state.skill ? 'Skill detail focused on ' + state.skill : 'Skill focus cleared');
      $('.skill-detail-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
}

function rosterRows() {
  const term = ($('#tableSearch').value || '').trim().toLowerCase();
  return activeScores({ applyRaw: true }).filter((score) => score.student_name.toLowerCase().includes(term));
}

function renderRoster() {
  const rows = rosterRows().sort((left, right) => (
    String(left[sort.key]).localeCompare(String(right[sort.key]), undefined, { numeric: true }) * sort.dir
  ));
  const columns = [
    ['student_name', 'Student'],
    ['grade', 'Grade'],
    ['section', 'Section'],
    ['student_group', 'Student Group'],
    ['purpose', 'P&O'],
    ['evidence', 'E&E'],
    ['language', 'LU&C'],
    ['raw_score', 'Raw Score'],
    ['band', 'Band'],
  ];

  $('#rosterCount').textContent = rows.length + ' student record' + (rows.length === 1 ? '' : 's') + ' shown';
  $('#rosterTable thead').innerHTML = '<tr>' + columns.map(([key, label]) => (
    '<th data-key="' + key + '">' + label + ' ' + (sort.key === key ? (sort.dir === 1 ? '&#8593;' : '&#8595;') : '') + '</th>'
  )).join('') + '</tr>';

  $('#rosterTable tbody').innerHTML = rows.length ? rows.map((score) => (
    '<tr data-id="' + score.student_score_id + '">'
      + columns.map(([key]) => {
        if (key === 'raw_score') return '<td class="raw-cell" style="--score-width:' + ((Number(score[key]) / 8) * 100) + '%"><span>' + escaped(score[key]) + '</span></td>';
        if (key === 'band') return '<td><span class="band-pill">' + escaped(score[key]) + '</span></td>';
        return '<td>' + escaped(score[key]) + '</td>';
      }).join('')
      + '</tr>'
  )).join('') : '<tr><td class="empty-row" colspan="9">No students match these filters.</td></tr>';

  $$('#rosterTable th').forEach((header) => {
    header.onclick = () => {
      const nextKey = header.dataset.key;
      if (sort.key === nextKey) {
        sort.dir *= -1;
      } else {
        sort.key = nextKey;
        sort.dir = 1;
      }
      renderRoster();
    };
  });
}

function renderSkillDetail() {
  const term = ($('#skillSearch').value || '').trim().toLowerCase();
  let rows = availableSkills();

  if (state.domain) rows = rows.filter((skill) => skill.domain === state.domain);
  if (state.skill) rows = rows.filter((skill) => skill.skill === state.skill);
  rows = rows.filter((skill) => (
    [skill.student_name, skill.domain, skill.skill, skill.rating, skill.grade, skill.section]
      .some((value) => String(value).toLowerCase().includes(term))
  ));

  const focus = state.skill || state.domain;
  $('#skillDetailCount').textContent = rows.length + ' skill rating' + (rows.length === 1 ? '' : 's') + ' shown' + (focus ? ' | ' + focus : '');
  $('#skillDetailTable tbody').innerHTML = rows.length ? rows.map((skill) => (
    '<tr><td>' + escaped(skill.student_name) + '</td><td>' + escaped(skill.domain) + '</td><td>' + escaped(skill.skill) + '</td>'
      + '<td><span class="skill-rating">' + escaped(skill.rating) + '</span></td><td>' + escaped(skill.grade) + '</td><td>' + escaped(skill.section) + '</td></tr>'
  )).join('') : '<tr><td class="empty-row" colspan="6">No skill ratings found.</td></tr>';
}

function showDetail(id) {
  const score = data.scores.find((item) => item.student_score_id === id);
  const skills = data.skills.filter((item) => item.student_score_id === id);
  const domains = ['Purpose & Organization', 'Evidence & Elaboration', 'Language Usage & Conventions'];

  $('#detailPanel').hidden = false;
  $('#detailTitle').textContent = score.student_name + ' - Rubric Detail';
  $('#detailSubtitle').textContent = 'Raw score ' + score.raw_score + ' / 8 | ' + score.band + ' | Grade ' + score.grade + ' Section ' + score.section;
  $('#studentDetail').innerHTML = domains.map((domain) => (
    '<article class="rubric-domain"><h3>' + domain + '</h3>'
      + skills.filter((skill) => skill.domain === domain).map((skill) => (
        '<div class="rubric-skill"><span>' + escaped(skill.skill) + '</span><span class="rating">' + escaped(skill.rating) + '</span></div>'
      )).join('')
      + '</article>'
  )).join('');
  $('#detailPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function render() {
  renderHeader();
  renderKpis();
  renderRaw();
  renderDomains();
  renderResources();
  renderSkills();
  renderRoster();
  renderSkillDetail();
  updateClearButtons();
}

function positionSkillTooltip(event) {
  const tooltip = $('#skillTooltip');
  const margin = 14;
  const width = tooltip.offsetWidth || 300;
  const height = tooltip.offsetHeight || 280;
  let left = event.clientX + margin;
  let top = event.clientY + margin;
  if (left + width > window.innerWidth - margin) left = event.clientX - width - margin;
  if (top + height > window.innerHeight - margin) top = event.clientY - height - margin;
  tooltip.style.left = Math.max(margin, left) + 'px';
  tooltip.style.top = Math.max(margin, top) + 'px';
}

function showSkillTooltip(event, domain, skillName, rows) {
  const ratings = ['Strong', 'Sufficient', 'Partial', 'Weak', 'Insufficient', 'Missing'];
  const total = rows.length;
  const tooltip = $('#skillTooltip');
  tooltip.innerHTML = '<strong>' + escaped(domain) + ' - ' + escaped(skillName) + '</strong>'
    + ratings.map((rating) => {
      const count = rows.filter((row) => row.rating === rating).length;
      return '<span class="tooltip-rating"><i style="background:' + ratingColors[rating] + '"></i><b>' + rating + '</b><em>' + count + '</em></span>';
    }).join('')
    + '<span class="tooltip-total"><b>Total</b><em>' + total + '</em></span>';
  tooltip.hidden = false;
  positionSkillTooltip(event);
}

function hideSkillTooltip() {
  $('#skillTooltip').hidden = true;
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function resetInteractiveFocus() {
  state.raw = null;
  state.domain = '';
  state.skill = '';
}

function bind() {
  const mapping = { gradeFilter: 'grade', sectionFilter: 'section', studentFilter: 'student' };

  Object.entries(mapping).forEach(([id, key]) => {
    $('#' + id).onchange = (event) => {
      state[key] = event.target.value;
      if (key === 'grade') {
        state.section = '';
        state.student = '';
      }
      if (key === 'section') state.student = '';
      resetInteractiveFocus();
      setFilters();
      render();
    };
  });

  $('#tableSearch').oninput = renderRoster;
  $('#skillSearch').oninput = renderSkillDetail;

  $('#resetButton').onclick = () => {
    state = { ...defaults };
    setFilters();
    render();
    showToast('Filters reset');
  };

  $('#clearRawScore').onclick = () => {
    state.raw = null;
    render();
  };

  $('#clearDomain').onclick = () => {
    state.domain = '';
    state.skill = '';
    render();
  };

  $('#clearSkill').onclick = () => {
    state.skill = '';
    render();
  };

  $('#closeDetail').onclick = () => {
    $('#detailPanel').hidden = true;
  };
}

Promise.all([
  fetch('data/student_scores.csv').then((response) => response.text()),
  fetch('data/student_skill_scores.csv').then((response) => response.text()),
]).then(([scores, skills]) => {
  data.scores = csv(scores);
  data.skills = csv(skills);
  setFilters();
  bind();
  render();
}).catch(() => {
  document.body.innerHTML = '<p style="padding:30px;font:18px Arial">Unable to load the demo data. Open this folder through a local web server.</p>';
});

function setAskAiOpen(open) {
  const modal = $('#askAiModal');
  if (!modal) return;
  if (open) {
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
  } else {
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.toggle('modal-open', open);
  if (open) $('.ask-ai-input input')?.focus();
}

$('#askAiButton')?.addEventListener('click', () => setAskAiOpen(true));
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-ai]')) setAskAiOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setAskAiOpen(false);
});

