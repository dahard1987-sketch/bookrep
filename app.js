(() => {
      const STORAGE_KEY = 'bookrep-reading-record-v2';
      const formElements = [...document.querySelectorAll('input, textarea')];
      const saveStatus = document.getElementById('saveStatus');
      const sheet = document.getElementById('sheet');
      const pdfBtn = document.getElementById('pdfBtn');
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
            if (el.type === 'radio') {
              el.checked = saved[el.name] === el.value;
            } else if (Object.prototype.hasOwnProperty.call(saved, key)) {
              el.value = saved[key];
            }
          });
        } catch (_) {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      function fitText(el) {
        const max = el.classList.contains('plain-textarea') ? 9.2 : 9.2;
        const min = 7.0;
        let size = max;
        el.style.fontSize = size + 'px';
        while (el.scrollHeight > el.clientHeight + 1 && size > min) {
          size -= 0.2;
          el.style.fontSize = size.toFixed(1) + 'px';
        }
      }

      function fitAll() {
        document.querySelectorAll('.fit-text').forEach(fitText);
      }

      function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(getData()));
        saveStatus.textContent = '저장됨';
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveStatus.textContent = '입력한 내용은 이 브라우저에 자동 저장됩니다.';
        }, 1300);
      }

      function formatDateValue(value) {
        const digits = value.replace(/\D/g, '').slice(0, 8);
        if (digits.length <= 4) return digits;
        if (digits.length <= 6) return digits.slice(0, 4) + '.' + digits.slice(4);
        return digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
      }

      function safeFilenamePart(value) {
        return value
          .trim()
          .replace(/[\\/:*?"<>|]/g, '')
          .replace(/\s+/g, ' ')
          .slice(0, 60);
      }

      function pdfFilename() {
        const writer = safeFilenamePart(document.getElementById('writerName').value) || '작성자';
        const round = safeFilenamePart(document.getElementById('recordNo').value.replace(/\D/g, '')) || '1';
        return `${writer}_${round}차.pdf`;
      }

      async function savePdf() {
        if (typeof html2canvas === 'undefined' || !window.jspdf?.jsPDF) {
          alert('PDF 저장 모듈을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
          return;
        }

        fitAll();
        saveData();
        pdfBtn.disabled = true;
        pdfBtn.textContent = 'PDF 생성 중…';
        saveStatus.textContent = 'PDF를 만들고 있습니다.';
        sheet.classList.add('is-exporting');

        try {
          if (document.fonts?.ready) await document.fonts.ready;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

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

          const imageData = canvas.toDataURL('image/jpeg', 0.98);
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
          });
          pdf.addImage(imageData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
          pdf.save(pdfFilename());

          saveStatus.textContent = `${pdfFilename()} 저장 완료`;
        } catch (error) {
          console.error(error);
          saveStatus.textContent = 'PDF 저장에 실패했습니다.';
          alert('PDF 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
          sheet.classList.remove('is-exporting');
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

      document.getElementById('printBtn').addEventListener('click', () => {
        fitAll();
        saveData();
        window.print();
      });

      pdfBtn.addEventListener('click', savePdf);

      document.getElementById('clearBtn').addEventListener('click', () => {
        const confirmed = window.confirm('작성한 내용을 모두 지울까요?');
        if (!confirmed) return;

        formElements.forEach((el) => {
          if (el.type === 'radio') el.checked = false;
          else el.value = el.id === 'recordNo' ? '1' : '';
          if (el.matches('.fit-text')) el.style.fontSize = '';
        });
        localStorage.removeItem(STORAGE_KEY);
        saveStatus.textContent = '모든 내용이 지워졌습니다.';
      });

      window.addEventListener('beforeprint', fitAll);
      restoreData();
      fitAll();
    })();
