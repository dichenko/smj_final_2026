var state = {
  section: 'all',
  search: '',
  page: 1,
  limit: 20,
  total: 0
};

var editId = null;
var modal = document.getElementById('edit-modal');
var modalTextarea = document.getElementById('edit-textarea');

function debounce(fn, delay) {
  var timer;
  return function() {
    var context = this;
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(context, args); }, delay);
  };
}

function sectionLabel(section) {
  if (section === 'green') return 'Успех';
  if (section === 'blue') return 'Ляп';
  return 'Инсайт';
}

function loadAdmin() {
  var container = document.getElementById('table-container');
  container.innerHTML = '<div class="loading">Загрузка...</div>';

  var params = new URLSearchParams({
    section: state.section,
    search: state.search,
    page: state.page,
    limit: state.limit
  });

  fetch('/api/admin?' + params.toString())
    .then(function(response) { return response.json(); })
    .then(function(data) {
      state.total = data.total;
      renderTable(data.rows);
      renderPagination();
    })
    .catch(function() {
      container.innerHTML = '<div class="error">Ошибка загрузки</div>';
    });
}

function renderTable(rows) {
  var container = document.getElementById('table-container');

  if (!rows.length) {
    container.innerHTML = '<div class="no-data">Записей не найдено</div>';
    return;
  }

  var html = '<table class="admin-table"><thead><tr>' +
    '<th>Раздел</th><th>Текст</th><th>Дата</th><th>Время</th><th>Действия</th>' +
    '</tr></thead><tbody>';

  rows.forEach(function(row) {
    var date = new Date(row.created_at);
    var dateStr = date.toLocaleDateString('ru-RU');
    var timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    html += '<tr>';
    html += '<td><span class="section-badge ' + row.section + '"></span>' + sectionLabel(row.section) + '</td>';

    html += '<td class="text-cell">';
    if (!row.is_active) {
      html += '<span class="version-badge">пред. версия</span>';
    }
    html += '<span' + (!row.is_active ? ' class="inactive-marker"' : '') + '>' +
      escapeHtml(row.text) + '</span>';
    html += '</td>';

    html += '<td>' + dateStr + '</td>';
    html += '<td>' + timeStr + '</td>';

    html += '<td class="actions-cell">';
    html += '<button class="btn-action btn-edit" data-id="' + row.id + '" data-text="' +
      escapeAttr(row.text) + '">Ред.</button>';
    html += '<button class="btn-action btn-delete" data-id="' + row.id + '">Удалить</button>';
    html += '</td>';

    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('.btn-edit').forEach(function(button) {
    button.addEventListener('click', function() {
      editId = button.getAttribute('data-id');
      modalTextarea.value = button.getAttribute('data-text');
      modal.style.display = 'flex';
    });
  });

  container.querySelectorAll('.btn-delete').forEach(function(button) {
    button.addEventListener('click', function() {
      if (!confirm('Удалить запись?')) return;
      var id = button.getAttribute('data-id');
      fetch('/api/admin/' + id, { method: 'DELETE' })
        .then(function(response) { return response.json(); })
        .then(function() { loadAdmin(); })
        .catch(function() { alert('Ошибка удаления'); });
    });
  });
}

function renderPagination() {
  var container = document.getElementById('pagination');
  var totalPages = Math.ceil(state.total / state.limit);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  var html = '';

  html += '<button class="pagination-btn"' + (state.page <= 1 ? ' disabled' : '') +
    ' data-page="' + (state.page - 1) + '">Назад</button>';

  var start = Math.max(1, state.page - 3);
  var end = Math.min(totalPages, state.page + 3);

  for (var i = start; i <= end; i++) {
    html += '<button class="pagination-btn' + (i === state.page ? ' active' : '') +
      '" data-page="' + i + '">' + i + '</button>';
  }

  html += '<button class="pagination-btn"' + (state.page >= totalPages ? ' disabled' : '') +
    ' data-page="' + (state.page + 1) + '">Вперед</button>';

  html += ' <select class="page-size-select" id="page-size">';
  [20, 50, 100].forEach(function(count) {
    html += '<option value="' + count + '"' + (state.limit === count ? ' selected' : '') + '>' +
      count + ' на стр.</option>';
  });
  html += '</select>';

  container.innerHTML = html;

  container.querySelectorAll('.pagination-btn').forEach(function(button) {
    button.addEventListener('click', function() {
      if (button.disabled) return;
      state.page = parseInt(button.getAttribute('data-page'));
      loadAdmin();
    });
  });

  document.getElementById('page-size').addEventListener('change', function() {
    state.limit = parseInt(this.value);
    state.page = 1;
    loadAdmin();
  });
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.querySelectorAll('.admin-filters .filter-btn').forEach(function(button) {
  button.addEventListener('click', function() {
    document.querySelectorAll('.admin-filters .filter-btn').forEach(function(item) {
      item.classList.remove('active');
    });
    button.classList.add('active');
    state.section = button.getAttribute('data-section');
    state.page = 1;
    loadAdmin();
  });
});

document.getElementById('search').addEventListener('input', debounce(function() {
  state.search = this.value;
  state.page = 1;
  loadAdmin();
}, 400));

document.getElementById('modal-cancel').addEventListener('click', function() {
  modal.style.display = 'none';
  editId = null;
});

document.getElementById('modal-save').addEventListener('click', function() {
  var text = modalTextarea.value;
  if (!text || !text.trim()) return;

  fetch('/api/admin/' + editId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  })
    .then(function(response) { return response.json(); })
    .then(function() {
      modal.style.display = 'none';
      editId = null;
      loadAdmin();
    })
    .catch(function() { alert('Ошибка сохранения'); });
});

modal.addEventListener('click', function(event) {
  if (event.target === modal) {
    modal.style.display = 'none';
    editId = null;
  }
});

loadAdmin();
