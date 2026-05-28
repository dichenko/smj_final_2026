var state = {
  green: { visible: false, items: [] },
  blue: { visible: false, items: [] },
  red: { visible: false, items: [] }
};

var sectionOrder = ['green', 'blue', 'red'];

function escapeText(text) {
  var node = document.createElement('div');
  node.textContent = text;
  return node.innerHTML;
}

function escapeAttr(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shortenText(text) {
  if (text.length <= 50) {
    return text;
  }
  return text.slice(0, 47).trimEnd() + '...';
}

function groupItems(items) {
  var grouped = {
    green: [],
    blue: [],
    red: []
  };

  items.forEach(function(item) {
    if (grouped[item.section]) {
      grouped[item.section].push(item);
    }
  });

  return grouped;
}

function renderSection(section) {
  var list = document.getElementById('list-' + section);
  var button = document.querySelector('.toggle-section[data-section="' + section + '"]');
  var sectionState = state[section];

  button.textContent = sectionState.visible ? '-' : '+';
  button.setAttribute('aria-label', sectionState.visible ? 'Скрыть' : 'Показать');
  button.setAttribute('aria-expanded', sectionState.visible ? 'true' : 'false');
  list.classList.toggle('is-visible', sectionState.visible);

  if (!sectionState.visible) {
    list.innerHTML = '';
    return;
  }

  if (sectionState.items.length === 0) {
    list.innerHTML = '<div class="empty-section">Пока нет ответов</div>';
    return;
  }

  list.innerHTML = sectionState.items.map(function(item) {
    return '<div class="response-item" tabindex="0" data-full="' + escapeAttr(item.text) + '">' +
      escapeText(shortenText(item.text)) +
      '</div>';
  }).join('');
}

function renderCounts() {
  document.getElementById('counts-indicator').textContent = sectionOrder.map(function(section) {
    return state[section].items.length;
  }).join('/');
}

function renderAll() {
  sectionOrder.forEach(renderSection);
  renderCounts();
}

function loadResponses() {
  fetch('/api/public')
    .then(function(response) { return response.json(); })
    .then(function(items) {
      var grouped = groupItems(items);
      sectionOrder.forEach(function(section) {
        state[section].items = grouped[section];
      });
      renderAll();
    })
    .catch(function() {
      document.getElementById('counts-indicator').textContent = 'ошибка';
    });
}

document.querySelectorAll('.toggle-section').forEach(function(button) {
  button.addEventListener('click', function() {
    var section = button.getAttribute('data-section');
    state[section].visible = !state[section].visible;
    renderSection(section);
  });
});

loadResponses();
setInterval(loadResponses, 3000);
