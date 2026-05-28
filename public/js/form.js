var form = document.getElementById('answers-form');
var thanksPanel = document.getElementById('thanks-panel');

function showToast(message) {
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

function showThanks() {
  form.hidden = true;
  thanksPanel.hidden = false;
}

function collectAnswers() {
  return {
    success: form.querySelector('[name="success"]').value.trim(),
    lapse: form.querySelector('[name="lapse"]').value.trim(),
    insight: form.querySelector('[name="insight"]').value.trim()
  };
}

fetch('/api/answers/status')
  .then(function(response) { return response.json(); })
  .then(function(data) {
    if (data.submitted) {
      showThanks();
    }
  })
  .catch(function() {
    showToast('Не удалось проверить статус отправки');
  });

form.addEventListener('submit', function(event) {
  event.preventDefault();

  var button = form.querySelector('.btn-submit');
  var answers = collectAnswers();
  var hasContent = Object.keys(answers).some(function(key) {
    return answers[key].length > 0;
  });

  if (!hasContent) {
    showToast('Заполните хотя бы одно поле');
    return;
  }

  button.textContent = 'Отправка...';
  button.disabled = true;

  fetch('/api/answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(answers)
  })
    .then(function(response) {
      if (response.status === 409) {
        return { success: true, alreadySubmitted: true };
      }
      return response.json();
    })
    .then(function(data) {
      if (data.success || data.alreadySubmitted) {
        showThanks();
        return;
      }

      button.textContent = 'Отправить';
      button.disabled = false;
      showToast('Ошибка при сохранении');
    })
    .catch(function() {
      button.textContent = 'Отправить';
      button.disabled = false;
      showToast('Ошибка соединения');
    });
});
