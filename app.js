(() => {
  const STORAGE_KEY = 'bookrep-reading-record-v2';
  document.querySelectorAll('.ruled-field').forEach((field) => {
    const countClass = [...field.classList].find((name) => /^lines-\d+$/.test(name));
    const count = Number(countClass?.split('-')[1] || 2);
    const lineLayer = document.createElement('div');
    lineLayer.className = 'rule-lines';
    lineLayer.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < count; index += 1) lineLayer.append(document.createElement('span'));
    field.prepend(lineLayer);
  });

  const formElements = [...document.querySelectorAll('input, textarea')];
  const textareas = [...document.querySelectorAll('textarea.fit-text')];
  const sheets = [...document.querySelectorAll('.sheet')];
  const saveStatus = document.getElementById('saveStatus');
  const pdfBtn = document.getElementById('pdfBtn');
  const printBtn = document.getElementById('printBtn');
  const recordNo = document.getElementById('recordNo');
  const writerName = document.getElementById('writerName');
  const recordNoRepeat = document.getElementById('recordNoRepeat');
  const writerNameRepeat = document.getElementById('writerNameRepeat');
  let saveTimer;

  function getData() {
    const data = {};
    formElements.forEach((el) => {
      if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name || el.id] = el.value;
      }
    });
    return data;
  }

  function restoreData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      formElements.forEach((el) => {
        const key = el.name || el.id;
        if (el.type === 'radio') el.checked = saved[el.name] === el.value;
        else if (Object.prototype.hasOwnProperty.call(saved, key)) el.value = saved[key];
      });
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function updateRepeatHeader() {
    recordNoRepeat.textContent = recordNo.value.trim() || '1';
    writerNameRepeat.textContent = writerName.value.trim() || '';
  }

  function fitText(el) {
    const max = 10;
    const min = 7.2;
    let size = max;
    el.style.fontSize = `${size}px`;
    while (el.scrollHeight > el.clientHeight + 1 && size > min) {
      size -= 0.2;
      el.style.fontSize = `${size.toFixed(1)}px`;
    }
  }

  function fitAll() { textareas.forEach(fitText); }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getData()));
    updateRepeatHeader();
    saveStatus.textContent = '저장됨';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveStatus.textContent = '입력한 내용은 이 브라우저에 자동 저장됩니다.';
    }, 1300);
  }

  function formatDateValue(value) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
  }

  function safeFilenamePart(value) {
    return value.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').slice(0, 60);
  }

  function pdfFilename() {
    const writer = safeFilenamePart(writerName.value) || '작성자';
    const round = safeFilenamePart(recordNo.value.replace(/\D/g, '')) || '1';
    return `${writer}_${round}차.pdf`;
  }

  function setOutputMode(className, enabled) {
    sheets.forEach((sheet) => sheet.classList.toggle(className, enabled));
    fitAll();
  }

  async function savePdf() {
    if (typeof html2canvas === 'undefined' || !window.jspdf?.jsPDF) {
      alert('PDF 저장 모듈을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    saveData();
    pdfBtn.disabled = true;
    pdfBtn.textContent = 'PDF 생성 중…';
    saveStatus.textContent = '2쪽 PDF를 만들고 있습니다.';
    setOutputMode('is-exporting', true);

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

      for (let index = 0; index < sheets.length; index += 1) {
        const sheet = sheets[index];
        const canvas = await html2canvas(sheet, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          windowWidth: sheet.scrollWidth,
          windowHeight: sheet.scrollHeight,
          logging: false
        });
        if (index > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      pdf.save(pdfFilename());
      saveStatus.textContent = `${pdfFilename()} 저장 완료`;
    } catch (error) {
      console.error(error);
      saveStatus.textContent = 'PDF 저장에 실패했습니다.';
      alert('PDF 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setOutputMode('is-exporting', false);
      pdfBtn.disabled = false;
      pdfBtn.textContent = 'PDF 저장';
    }
  }

  formElements.forEach((el) => {
    el.addEventListener('input', () => {
      if (el.classList.contains('date-input')) {
        const caretAtEnd = el.selectionStart === el.value.length;
        el.value = formatDateValue(el.value);
        if (caretAtEnd) el.setSelectionRange(el.value.length, el.value.length);
      }
      if (el.matches('.fit-text')) fitText(el);
      saveData();
    });
    el.addEventListener('change', saveData);
  });

  printBtn.addEventListener('click', () => {
    saveData();
    setOutputMode('is-printing', true);
    requestAnimationFrame(() => window.print());
  });

  pdfBtn.addEventListener('click', savePdf);

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!window.confirm('작성한 내용을 모두 지울까요?')) return;
    formElements.forEach((el) => {
      if (el.type === 'radio') el.checked = false;
      else el.value = el.id === 'recordNo' ? '1' : '';
      if (el.matches('.fit-text')) el.style.fontSize = '';
    });
    localStorage.removeItem(STORAGE_KEY);
    updateRepeatHeader();
    fitAll();
    saveStatus.textContent = '모든 내용이 지워졌습니다.';
  });

  window.addEventListener('beforeprint', () => setOutputMode('is-printing', true));
  window.addEventListener('afterprint', () => setOutputMode('is-printing', false));
  window.addEventListener('resize', () => requestAnimationFrame(fitAll));

  restoreData();
  updateRepeatHeader();
  fitAll();
})();
