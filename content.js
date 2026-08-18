// content.js — Saraban Tools (auto engine only)

if (!window.__sarabanToolsLoaded) {
  window.__sarabanToolsLoaded = true;

  let stopAutoFlag = false;

  // ============================================================
  // ค้นหา trigger elements ตามโหมดที่ระบุ
  // ============================================================
  function findTriggers(triggerMode) {
    if (triggerMode === 'clock') {
      // ปุ่มนาฬิกา (คอลัมน์ 3)
      // รองรับทั้งแบบมี/ไม่มี role="row", class .odd/.even, และ DataTables selectors
      const selectors = [
        'table tbody tr td:nth-child(3) i.fa-clock-o',
        'table tbody tr td:nth-child(3) i.fa.fa-clock-o',
        'table tr td:nth-child(3) i.fa-clock-o',
        'table tr td:nth-child(3) i.fa.fa-clock-o',
        'tr[role="row"] td:nth-child(3) i.fa-clock-o',
        'tr.odd td:nth-child(3) i.fa-clock-o',
        'tr.even td:nth-child(3) i.fa-clock-o',
        'td:nth-child(3) i.fa-clock-o',
        'td:nth-child(3) .fa-clock-o'
      ];
      const elements = Array.from(document.querySelectorAll(selectors.join(', ')));
      return elements.filter((el, idx, arr) => {
        const isVisible = el.offsetParent !== null || el.getClientRects().length > 0;
        return isVisible && arr.indexOf(el) === idx;
      });
    } else {
      // ปุ่มแก้ไข (คอลัมน์ 10 หรือ dropdown/btn-group)
      const buttons = Array.from(document.querySelectorAll(
        'tr td div.btn-group button, tr td button, tr td a.btn, tr[role="row"] td div.btn-group button'
      ));
      return buttons.filter((btn, idx, arr) => {
        const icon = btn.querySelector('i.fa-edit, i.fa.fa-edit, .fa-edit, [class*="fa-edit"]');
        const isVisible = btn.offsetParent !== null || btn.getClientRects().length > 0;
        return icon && isVisible && arr.indexOf(btn) === idx;
      });
    }
  }

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el && (el.offsetParent !== null || el.getClientRects().length > 0)) { resolve(el); return; }
      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found && (found.offsetParent !== null || found.getClientRects().length > 0)) {
          obs.disconnect();
          resolve(found);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
      setTimeout(() => { obs.disconnect(); resolve(document.querySelector(selector) || null); }, timeout);
    });
  }

  function waitForGone(selector, timeout = 4000) {
    return new Promise((resolve) => {
      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (!el || el.offsetParent === null) { obs.disconnect(); resolve(); }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
      const el = document.querySelector(selector);
      if (!el || el.offsetParent === null) { resolve(); return; }
      setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function findPidNganLabel() {
    return Array.from(document.querySelectorAll('label, span, div'))
      .find(l => {
        const text = l.textContent.trim();
        return (text === 'ปิดงาน' || text.includes('ปิดงาน')) && (l.offsetParent !== null || l.getClientRects().length > 0);
      });
  }

  function findCheckbox() {
    const byId = document.querySelector('#basic_checkbox_1');
    if (byId && (byId.offsetParent !== null || byId.getClientRects().length > 0)) return byId;

    const modalCheckboxes = Array.from(document.querySelectorAll('.modal input[type="checkbox"], div[role="dialog"] input[type="checkbox"]'))
      .filter(cb => cb.offsetParent !== null || cb.getClientRects().length > 0);
    if (modalCheckboxes.length > 0) return modalCheckboxes[0];

    return byId;
  }

  function closeModal() {
    const btn = document.querySelector(
      '.modal.in button.close, .modal.show button.close, [data-dismiss="modal"], button.bootbox-close-button'
    );
    if (btn && btn.offsetParent !== null) { btn.click(); return; }
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
      }).catch(() => {});
      return;
    }

    const limit = maxRows === 0 ? triggers.length : Math.min(maxRows, triggers.length);

    chrome.runtime.sendMessage({
      action: 'progress', current: 0, total: limit,
      message: `พบ ${triggers.length} แถว จะประมวลผล ${limit} แถว`
    }).catch(() => {});

    let processed = 0;

    for (let i = 0; i < limit; i++) {
      if (stopAutoFlag) break;

      // ตรวจสอบว่า element ยังอยู่ใน DOM หรือไม่ ถ้าไม่อยู่ให้ query ใหม่
      let el = triggers[i];
      if (!el || !document.body.contains(el)) {
        triggers = findTriggers(triggerMode);
        el = triggers[i] || triggers[0];
      }

      if (!el) {
        chrome.runtime.sendMessage({
          action: 'progress', current: processed, total: limit,
          message: `ไม่พบแถวที่ ${i + 1} เพิ่มเติม — สิ้นสุดการทำงาน`, warning: true
        }).catch(() => {});
        break;
      }

      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(200);
      el.click();

      // รอ checkbox หรือ label ใน modal
      const checkbox = await waitForElement('#basic_checkbox_1', 5000);
      if (!checkbox) {
        const label = findPidNganLabel();
        if (!label) {
          chrome.runtime.sendMessage({
            action: 'progress', current: i + 1, total: limit,
            message: `แถว ${i + 1}: modal ไม่เปิด — ข้าม`, warning: true
          }).catch(() => {});
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
      }).catch(() => {});

      await sleep(400);

      // ปิด modal ถ้ายังค้างอยู่
      const stillOpen = document.querySelector('#basic_checkbox_1');
      if (stillOpen && stillOpen.offsetParent !== null) {
        closeModal();
        await waitForGone('#basic_checkbox_1', 3000);
      }

      if (i < limit - 1 && !stopAutoFlag) await sleep(delayMs);
    }

    chrome.runtime.sendMessage({
      action: 'done', processed, total: limit
    }).catch(() => {});
  }

  // ============================================================
  // Message listener
  // ============================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'startAuto')      runAuto(msg.maxRows, msg.delayMs, msg.triggerMode || 'clock');
    if (msg.action === 'stopAuto')       stopAutoFlag = true;
    return false;
  });
}
