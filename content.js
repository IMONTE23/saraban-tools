// content.js — Saraban Tools (auto engine only)

if (!window.__sarabanToolsLoaded) {
  window.__sarabanToolsLoaded = true;

  let stopAutoFlag = false;

  function isVisible(el) {
    return el && (el.offsetParent !== null || el.getClientRects().length > 0);
  }

  // ============================================================
  // ค้นหาแถวและ trigger elements ตามโหมดที่ระบุ
  // ============================================================
  function findRowTriggers(triggerMode) {
    const rows = Array.from(document.querySelectorAll('table tbody tr, table tr'))
      .filter(tr => isVisible(tr) && !tr.dataset.sarabanDone && tr.querySelectorAll('td').length > 1);

    const items = [];
    for (const tr of rows) {
      let trigger = null;
      if (triggerMode === 'clock') {
        trigger = tr.querySelector([
          'td:nth-child(3) i.fa-clock-o',
          'td:nth-child(3) i.fa.fa-clock-o',
          'td:nth-child(3) [class*="fa-clock"]',
          'i.fa-clock-o',
          'i.fa.fa-clock-o',
          '[class*="fa-clock"]'
        ].join(', '));
      } else {
        // โหมดรอลงทะเบียน: ตาม r.json
        // r.json: tr.odd:nth-of-type(1) > td:nth-of-type(10) > div.btn-group > button.btn.btn-sm.btn-success:nth-of-type(2) > i.fa.fa-edit
        trigger = tr.querySelector([
          'td:nth-of-type(10) div.btn-group button.btn.btn-sm.btn-success:nth-of-type(2) > i.fa.fa-edit',
          'td:nth-of-type(10) div.btn-group button.btn.btn-sm.btn-success:nth-of-type(2) > i.fa-edit',
          'td:nth-of-type(10) div.btn-group button.btn-success:nth-of-type(2) i',
          'td:nth-of-type(10) div.btn-group button.btn-success:nth-of-type(2)',
          'div.btn-group button.btn.btn-sm.btn-success:nth-of-type(2) > i.fa.fa-edit',
          'div.btn-group button.btn-success:nth-of-type(2) i',
          'div.btn-group button.btn-success:nth-of-type(2)',
          'button.btn-sm.btn-success:nth-of-type(2) > i.fa.fa-edit',
          'button.btn-sm.btn-success:nth-of-type(2) > i.fa-edit',
          'button.btn-sm.btn-success:nth-of-type(2)',
          'button[onclick*="recvdoc"]',
          'button.btn-success i.fa.fa-edit',
          'button.btn-success i.fa-edit',
          'button.btn-success [class*="fa-edit"]',
          'button.btn-success',
          'i.fa.fa-edit',
          'i.fa-edit'
        ].join(', '));
      }

      if (trigger && isVisible(trigger)) {
        items.push({ row: tr, trigger: trigger });
      }
    }

    // Fallback: ถ้าหาตามโครงสร้าง tr td ไม่เจอ ให้ค้นหาจาก element ตรงๆ
    if (items.length === 0) {
      let elements = [];
      if (triggerMode === 'clock') {
        elements = Array.from(document.querySelectorAll('i.fa-clock-o, i.fa.fa-clock-o, [class*="fa-clock"]'));
      } else {
        elements = Array.from(document.querySelectorAll([
          'button.btn.btn-sm.btn-success:nth-of-type(2) > i.fa.fa-edit',
          'button.btn-sm.btn-success:nth-of-type(2) > i.fa-edit',
          'button.btn-sm.btn-success:nth-of-type(2)',
          'button[onclick*="recvdoc"]',
          'button.btn-success i.fa.fa-edit',
          'button.btn-success i.fa-edit',
          'button.btn-success [class*="fa-edit"]',
          'button.btn-success',
          'i.fa.fa-edit',
          'i.fa-edit'
        ].join(', ')));
      }
      for (const el of elements) {
        if (isVisible(el) && !el.closest('[data-saraban-done="true"]')) {
          items.push({ row: el.closest('tr') || el, trigger: el });
        }
      }
    }

    return items;
  }

  function waitForElement(selector, timeout = 7000) {
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

  function findPidNganLabel() {
    // 1. Selector ตรงตาม r.json: div.col-sm-4:nth-of-type(1) > label
    const specific = document.querySelector('div.col-sm-4:nth-of-type(1) > label, div.col-sm-4 > label');
    if (specific && isVisible(specific) && specific.textContent.includes('ปิดงาน')) {
      return specific;
    }

    // 2. label[for="basic_checkbox_1"]
    const forCb = document.querySelector('label[for="basic_checkbox_1"]');
    if (forCb && isVisible(forCb)) return forCb;

    // 3. ค้นหา label ที่มีข้อความ "ปิดงาน"
    const labels = Array.from(document.querySelectorAll('label')).filter(isVisible);
    const exact = labels.find(l => l.textContent.trim() === 'ปิดงาน');
    if (exact) return exact;
    const partial = labels.find(l => l.textContent.includes('ปิดงาน'));
    if (partial) return partial;

    // 4. Fallback หาจาก span, div, a, button
    return Array.from(document.querySelectorAll('span, div, a, button'))
      .find(l => {
        const text = l.textContent.trim();
        return (text === 'ปิดงาน' || text.includes('ปิดงาน')) && isVisible(l);
      }) || null;
  }

  function findCheckbox() {
    const byId = document.querySelector('#basic_checkbox_1');
    if (isVisible(byId)) return byId;

    const modalCheckboxes = Array.from(document.querySelectorAll('.modal input[type="checkbox"], div[role="dialog"] input[type="checkbox"], input[type="checkbox"]'))
      .filter(cb => isVisible(cb));
    if (modalCheckboxes.length > 0) return modalCheckboxes[0];

    return byId || null;
  }

  async function runAuto(maxRows, delayMs, triggerMode) {
    stopAutoFlag = false;

    // ล้าง flag แถวที่ทำเสร็จแล้วก่อนหน้า
    document.querySelectorAll('[data-saraban-done]').forEach(el => {
      delete el.dataset.sarabanDone;
    });

    const initialItems = findRowTriggers(triggerMode);
    if (initialItems.length === 0) {
      const btnName = triggerMode === 'clock' ? 'ระหว่างดำเนินการ (ปุ่มนาฬิกา)' : 'รอลงทะเบียน (ปุ่มแก้ไข)';
      chrome.runtime.sendMessage({
        action: 'error',
        message: `ไม่พบปุ่ม ${btnName} ในหน้านี้ — กรุณาตรวจสอบว่าเปิดหน้าตารางอยู่`
      }).catch(() => { });
      return;
    }

    const totalAvailable = initialItems.length;
    const limit = maxRows === 0 ? totalAvailable : Math.min(maxRows, totalAvailable);

    chrome.runtime.sendMessage({
      action: 'progress', current: 0, total: limit,
      message: `พบ ${totalAvailable} แถว จะประมวลผล ${limit} แถว`
    }).catch(() => { });

    let processed = 0;

    for (let i = 0; i < limit; i++) {
      if (stopAutoFlag) break;

      const currentItems = findRowTriggers(triggerMode);
      if (currentItems.length === 0) {
        chrome.runtime.sendMessage({
          action: 'progress', current: processed, total: limit,
          message: `ไม่มีแถวคงเหลือในหน้านี้ — ดำเนินการสำเร็จ ${processed} แถว`, warning: true
        }).catch(() => { });
        break;
      }

      const item = currentItems[0];
      const rowEl = item.row;
      const triggerEl = item.trigger;

      triggerEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(150);

      // 1. คลิกปุ่มแก้ไขในตาราง (ตาม r.json: tr.odd:nth-of-type(1) > td:nth-of-type(10) > div.btn-group > button.btn.btn-sm.btn-success:nth-of-type(2) > i.fa.fa-edit)
      const clickable = triggerEl.closest('button, a') || triggerEl;
      clickable.click();

      // 2. รอให้ Modal โหลดขึ้นมา (ตาม r.json: div.col-sm-4:nth-of-type(1) > label / #basic_checkbox_1)
      let readyEl = await waitForElement('div.col-sm-4 > label, #basic_checkbox_1', 7000);

      // หน่วงเวลาเพื่อให้ระบบสารบรรณโหลดข้อมูลและเตรียมสถานะใน Modal ให้พร้อมสมบูรณ์
      await sleep(1000);

      const label = findPidNganLabel();
      const checkbox = findCheckbox();

      if (!label && !checkbox) {
        if (rowEl && rowEl.dataset) rowEl.dataset.sarabanDone = 'true';
        chrome.runtime.sendMessage({
          action: 'progress', current: processed, total: limit,
          message: `แถวที่ ${i + 1}: ไม่พบตัวเลือกปิดงาน — ข้าม`, warning: true
        }).catch(() => { });
        continue;
      }

      // 3. คลิกที่ Label "ปิดงาน" (ตาม r.json: div.col-sm-4:nth-of-type(1) > label)
      if (label) {
        label.scrollIntoView({ block: 'center', behavior: 'smooth' });
        label.click();
        await sleep(200);
      }

      // 4. ตรวจสอบ Checkbox #basic_checkbox_1 (ตาม r.json: #basic_checkbox_1)
      const targetCheckbox = findCheckbox();
      if (targetCheckbox && !targetCheckbox.checked) {
        targetCheckbox.click();
        targetCheckbox.checked = true;
        targetCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (rowEl && rowEl.dataset) {
        rowEl.dataset.sarabanDone = 'true';
      }

      processed++;
      chrome.runtime.sendMessage({
        action: 'progress', current: processed, total: limit,
        message: `ปิดงานแถวที่ ${i + 1} เรียบร้อย`
      }).catch(() => { });

      // 5. รอระบบประมวลผลบันทึกและ Modal ปิดลงอัตโนมัติ
      await waitForGone('#basic_checkbox_1', 4000);
      await sleep(400);

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
