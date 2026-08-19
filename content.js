// content.js — Saraban Tools (auto engine only)

if (!window.__sarabanToolsLoaded) {
  window.__sarabanToolsLoaded = true;

  let stopAutoFlag = false;

  function isVisible(el) {
    return el && (el.offsetParent !== null || el.getClientRects().length > 0);
  }

  // ============================================================
  // ค้นหา trigger elements ตามโหมดที่ระบุ
  // ============================================================
  function findTriggers(triggerMode) {
    if (triggerMode === 'clock') {
      // ปุ่มนาฬิกา (คอลัมน์ 3)
      const selectors = [
        'table tbody tr td:nth-child(3) i.fa-clock-o',
        'table tbody tr td:nth-child(3) i.fa.fa-clock-o',
        'tr td:nth-child(3) i.fa-clock-o',
        'tr td:nth-child(3) i.fa.fa-clock-o',
        'tr td:nth-child(3) [class*="fa-clock"]',
        'td:nth-child(3) i.fa-clock-o',
        'td:nth-child(3) .fa-clock-o'
      ];
      const elements = Array.from(document.querySelectorAll(selectors.join(', ')));
      return elements.filter((el, idx, arr) => {
        return isVisible(el) && arr.indexOf(el) === idx;
      });
    } else {
      // โหมดรอลงทะเบียน: ปุ่มแก้ไข (button.btn-success > i.fa-edit / i.fa.fa-edit)
      const editSelectors = [
        'button.btn.btn-sm.btn-success:nth-of-type(2) > i.fa.fa-edit',
        'button.btn.btn-sm.btn-success > i.fa.fa-edit',
        'button.btn.btn-sm.btn-success > i.fa-edit',
        'button.btn-success i.fa.fa-edit',
        'button.btn-success i.fa-edit',
        'button.btn-success [class*="fa-edit"]',
        'tr td button.btn-success i',
        'tr td div.btn-group button i.fa-edit',
        'tr td div.btn-group button i.fa.fa-edit',
        'tr td button i.fa-edit',
        'tr td button i.fa.fa-edit',
        'tr td a i.fa-edit',
        'tr td a i.fa.fa-edit',
        'tr td i.fa-edit',
        'tr td i.fa.fa-edit',
        'tr td [class*="fa-edit"]',
        // Fallback: ซองจดหมาย
        'tr td:nth-child(2) i[class*="fa-envelope"]',
        'td:nth-child(2) i[class*="fa-envelope"]'
      ];

      const elements = Array.from(document.querySelectorAll(editSelectors.join(', ')))
        .filter((el, idx, arr) => {
          return isVisible(el) && arr.indexOf(el) === idx;
        });

      return elements;
    }
  }

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (isVisible(el)) { resolve(el); return; }
      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (isVisible(found)) {
          obs.disconnect();
          resolve(found);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
      setTimeout(() => {
        obs.disconnect();
        const found = document.querySelector(selector);
        resolve(isVisible(found) ? found : null);
      }, timeout);
    });
  }

  function waitForGone(selector, timeout = 4000) {
    return new Promise((resolve) => {
      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (!isVisible(el)) { obs.disconnect(); resolve(); }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
      const el = document.querySelector(selector);
      if (!isVisible(el)) { resolve(); return; }
      setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function findReceiveDocButton() {
    const btn = document.querySelector('#btn-receivedoc, .recvdoc, button#btn-receivedoc, span.recvdoc');
    if (isVisible(btn)) return btn;

    const byText = Array.from(document.querySelectorAll('button, span, a, div'))
      .find(el => {
        const text = el.textContent.trim();
        return (text === 'รับต้นฉบับ' || text.includes('รับต้นฉบับ')) && isVisible(el);
      });
    return byText || null;
  }

  function findPidNganLabel() {
    return Array.from(document.querySelectorAll('label, span, div'))
      .find(l => {
        const text = l.textContent.trim();
        return (text === 'ปิดงาน' || text.includes('ปิดงาน')) && isVisible(l);
      });
  }

  function findCheckbox() {
    const byId = document.querySelector('#basic_checkbox_1');
    if (isVisible(byId)) return byId;

    const modalCheckboxes = Array.from(document.querySelectorAll('.modal input[type="checkbox"], div[role="dialog"] input[type="checkbox"], input[type="checkbox"]'))
      .filter(cb => isVisible(cb));
    if (modalCheckboxes.length > 0) return modalCheckboxes[0];

    return byId;
  }

  function closeModal() {
    const btn = document.querySelector(
      '.modal.in button.close, .modal.show button.close, [data-dismiss="modal"], button.bootbox-close-button'
    );
    if (isVisible(btn)) { btn.click(); return; }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  }

  async function runAuto(maxRows, delayMs, triggerMode) {
    stopAutoFlag = false;

    let triggers = findTriggers(triggerMode);
    if (triggers.length === 0) {
      const btnName = triggerMode === 'clock' ? 'ระหว่างดำเนินการ (ปุ่มนาฬิกา)' : 'รอลงทะเบียน (ปุ่มแก้ไข)';
      chrome.runtime.sendMessage({
        action: 'error',
        message: `ไม่พบปุ่ม ${btnName} ในหน้านี้ — กรุณาตรวจสอบว่าเปิดหน้าตารางอยู่`
      }).catch(() => { });
      return;
    }

    const limit = maxRows === 0 ? triggers.length : Math.min(maxRows, triggers.length);

    chrome.runtime.sendMessage({
      action: 'progress', current: 0, total: limit,
      message: `พบ ${triggers.length} แถว จะประมวลผล ${limit} แถว`
    }).catch(() => { });

    let processed = 0;

    for (let i = 0; i < limit; i++) {
      if (stopAutoFlag) break;

      // ตรวจสอบ element ใน DOM ถ้าหายไปให้ query ใหม่
      let el = triggers[i];
      if (!el || !document.body.contains(el) || !isVisible(el)) {
        triggers = findTriggers(triggerMode);
        el = triggers[i] || triggers[0];
      }

      if (!el) {
        chrome.runtime.sendMessage({
          action: 'progress', current: processed, total: limit,
          message: `ไม่พบแถวที่ ${i + 1} เพิ่มเติม — สิ้นสุดการทำงาน`, warning: true
        }).catch(() => { });
        break;
      }

      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(200);

      // คลิกปุ่ม/ไอคอน
      const clickable = el.closest('button, a') || el;
      clickable.click();
      if (el !== clickable) {
        try { el.click(); } catch (_) { }
      }

      // รอ checkbox หรือ label ปิดงาน ใน modal
      let checkbox = await waitForElement('#basic_checkbox_1', 5000);
      if (!checkbox) {
        // เผื่อเป็น flow ที่ต้องกดรับต้นฉบับก่อน
        const recvBtn = findReceiveDocButton();
        if (recvBtn) {
          recvBtn.click();
          checkbox = await waitForElement('#basic_checkbox_1', 4000);
        }
      }

      if (!checkbox) {
        const label = findPidNganLabel();
        if (!label) {
          chrome.runtime.sendMessage({
            action: 'progress', current: processed, total: limit,
            message: `แถว ${i + 1}: modal ไม่เปิด — ข้าม`, warning: true
          }).catch(() => { });
          continue;
        }
      }

      await sleep(150);

      // คลิก label "ปิดงาน" (ถ้าเจอ)
      const label = findPidNganLabel();
      if (label) {
        label.click();
      }

      // ตรวจสอบ checkbox ว่าถูกติ๊กแล้วหรือไม่ ถ้ายังให้ติ๊กโดยตรง
      const targetCheckbox = findCheckbox();
      if (targetCheckbox && !targetCheckbox.checked) {
        targetCheckbox.click();
        targetCheckbox.checked = true;
        targetCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      processed++;
      chrome.runtime.sendMessage({
        action: 'progress', current: processed, total: limit,
        message: `ปิดงานแถวที่ ${i + 1} เรียบร้อย`
      }).catch(() => { });

      await sleep(400);

      // ปิด modal ถ้ายังค้างอยู่
      const stillOpen = document.querySelector('#basic_checkbox_1');
      if (isVisible(stillOpen)) {
        closeModal();
        await waitForGone('#basic_checkbox_1', 3000);
      }

      if (i < limit - 1 && !stopAutoFlag) await sleep(delayMs);
    }

    chrome.runtime.sendMessage({
      action: 'done', processed, total: limit
    }).catch(() => { });
  }

  // ============================================================
  // Message listener
  // ============================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'startAuto') runAuto(msg.maxRows, msg.delayMs, msg.triggerMode || 'edit');
    if (msg.action === 'stopAuto') stopAutoFlag = true;
    return false;
  });
}
