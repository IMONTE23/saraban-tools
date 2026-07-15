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
      return Array.from(
        document.querySelectorAll('tr[role="row"] td:nth-child(3) i.fa-clock-o, tr[role="row"] td:nth-child(3) i.fa.fa-clock-o')
      );
    } else {
      // ปุ่มแก้ไข (คอลัมน์ 10)
      return Array.from(document.querySelectorAll('tr[role="row"] td div.btn-group button'))
        .filter(btn => btn.querySelector('i.fa-edit, i.fa.fa-edit'));
    }
  }

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) { resolve(el); return; }
      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found && found.offsetParent !== null) { obs.disconnect(); resolve(found); }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
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
    return Array.from(document.querySelectorAll('label'))
      .find(l => l.textContent.trim().includes('ปิดงาน'));
  }

  function closeModal() {
    const btn = document.querySelector(
      '.modal.in button.close, .modal.show button.close, [data-dismiss="modal"]'
    );
    if (btn) { btn.click(); return; }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  }

  async function runAuto(maxRows, delayMs, triggerMode) {
    stopAutoFlag = false;

    const triggers = findTriggers(triggerMode);
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

      const el = triggers[i];
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(200);
      el.click();

      // รอ checkbox ใน modal
      const checkbox = await waitForElement('#basic_checkbox_1', 5000);
      if (!checkbox) {
        chrome.runtime.sendMessage({
          action: 'progress', current: i + 1, total: limit,
          message: `แถว ${i + 1}: modal ไม่เปิด — ข้าม`, warning: true
        }).catch(() => {});
        continue;
      }

      await sleep(150);

      // คลิก label "ปิดงาน" (ถ้าเจอ) หรือติ๊ก checkbox โดยตรง
      const label = findPidNganLabel();
      if (label) {
        label.click();
      } else {
        checkbox.click();
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
