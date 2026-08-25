// content.js — Saraban Tools (auto engine)

if (!window.__sarabanToolsLoaded) {
  window.__sarabanToolsLoaded = true;

  let stopAutoFlag = false;

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(el) : el.style;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return el.offsetParent !== null || el.getClientRects().length > 0 || (el.offsetWidth > 0 && el.offsetHeight > 0);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ============================================================
  // ค้นหาปุ่ม Trigger ในแถวสำหรับโหมด "รอลงทะเบียน" (Edit / Button 2)
  // อ้างอิงจาก รอลงทะเบียน.json:
  // td:nth-of-type(10) > div.btn-group > button.btn.btn-sm.btn-success:nth-of-type(2) > i.fa.fa-edit
  // ============================================================
  function findEditTrigger(tr) {
    // 1. หาไอคอนแก้ไข fa-edit / fa-pencil ภายในแถว (ความแม่นยำสูงสุด)
    const editIcon = tr.querySelector('i.fa-edit, i.fa.fa-edit, [class*="fa-edit"], [class*="fa-pencil"], i.fa-pencil');
    if (editIcon && isVisible(editIcon)) {
      return editIcon.closest('button, a') || editIcon;
    }

    // 2. หาปุ่มที่มี onclick เกี่ยวกับรับเอกสาร / แก้ไข
    const onclickBtn = tr.querySelector('button[onclick*="recvdoc"], button[onclick*="edit"], button[onclick*="reg"]');
    if (onclickBtn && isVisible(onclickBtn)) {
      return onclickBtn;
    }

    // 3. ค้นหาใน div.btn-group ในช่องจัดการ (td ช่องท้ายๆ หรือ td:nth-of-type(10))
    const btnGroup = tr.querySelector('td:nth-of-type(10) .btn-group, td:last-child .btn-group, .btn-group');
    if (btnGroup) {
      const buttons = Array.from(btnGroup.querySelectorAll('button, a')).filter(isVisible);
      if (buttons.length >= 2) {
        // ปุ่มที่ 2 ในกลุ่มปุ่ม (เช่น ปุ่มแก้ไขคู่กับปุ่มซองจดหมาย)
        return buttons[1];
      } else if (buttons.length === 1) {
        return buttons[0];
      }
    }

    // 4. ปุ่มที่มี title หรือข้อความเกี่ยวกับแก้ไข / ลงทะเบียน
    const titleBtn = tr.querySelector('button[title*="แก้ไข"], button[title*="ลงทะเบียน"], button[title*="รับเอกสาร"]');
    if (titleBtn && isVisible(titleBtn)) {
      return titleBtn;
    }

    // 5. Fallback ปุ่มสีเขียวใน td ช่องที่ 10
    const td10Btn = tr.querySelector('td:nth-of-type(10) button.btn-success, td:nth-of-type(10) button');
    if (td10Btn && isVisible(td10Btn)) {
      return td10Btn;
    }

    return null;
  }

  // ============================================================
  // ค้นหาปุ่ม Trigger ในแถวสำหรับโหมด "ระหว่างดำเนินการ" (Clock icon)
  // อ้างอิงจาก ระหว่างดำเนินการ.json:
  // td:nth-of-type(3) > i.fa.fa-clock-o
  // ============================================================
  function findClockTrigger(tr) {
    // 1. หาไอคอนนาฬิกาใน td ช่องที่ 3
    const td3Clock = tr.querySelector([
      'td:nth-of-type(3) > i.fa.fa-clock-o',
      'td:nth-of-type(3) > i.fa-clock-o',
      'td:nth-of-type(3) i.fa.fa-clock-o',
      'td:nth-of-type(3) [class*="fa-clock"]',
      'td:nth-child(3) [class*="fa-clock"]'
    ].join(', '));
    if (td3Clock && isVisible(td3Clock)) {
      return td3Clock.closest('button, a') || td3Clock;
    }

    // 2. หาไอคอนนาฬิกาที่ใดก็ได้ในแถว
    const anyClock = tr.querySelector('i.fa.fa-clock-o, i.fa-clock-o, [class*="fa-clock"]');
    if (anyClock && isVisible(anyClock)) {
      return anyClock.closest('button, a') || anyClock;
    }

    return null;
  }

  // ============================================================
  // ค้นหาแถวและ trigger elements ตามโหมดที่ระบุ
  // ============================================================
  function findRowTriggers(triggerMode) {
    const rows = Array.from(document.querySelectorAll('table tbody tr, table tr'))
      .filter(tr => isVisible(tr) && tr.dataset.sarabanDone !== 'true' && tr.querySelectorAll('td').length > 1);

    const items = [];
    for (const tr of rows) {
      const trigger = triggerMode === 'clock' ? findClockTrigger(tr) : findEditTrigger(tr);
      if (trigger && isVisible(trigger)) {
        items.push({ row: tr, trigger: trigger });
      }
    }
    return items;
  }

  // ============================================================
  // รอ Loading / Spinner ของระบบสารบรรณให้เสร็จสิ้น
  // ============================================================
  async function waitForLoadingToFinish(timeout = 6000) {
    const loaderSelectors = [
      '.blockUI', '.loading', '.loading-spinner', '.pace', '.overlay',
      'div[class*="loading"]', 'div[class*="spinner"]', 'div[class*="backdrop"]'
    ];
    const hasLoader = () => loaderSelectors.some(sel => {
      const el = document.querySelector(sel);
      return isVisible(el);
    });

    if (!hasLoader()) return;

    return new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (!hasLoader() || Date.now() - start > timeout) {
          clearInterval(interval);
          resolve();
        }
      }, 150);
    });
  }

  // ============================================================
  // ค้นหา Element "ปิดงาน" และ Checkbox ใน Modal ที่เปิดอยู่
  // อ้างอิงจาก json: div.col-sm-4:nth-of-type(1) > label (text: "ปิดงาน"), #basic_checkbox_1
  // ============================================================
  function findPidNganElements() {
    // ค้นหาขอบเขต Modal ที่เปิดอยู่ก่อน
    const openModal = Array.from(document.querySelectorAll('.modal.in, .modal.show, div.modal, div[role="dialog"]'))
      .find(isVisible);
    const scope = openModal || document;

    // 1. ค้นหา Checkbox #basic_checkbox_1
    let checkbox = scope.querySelector('#basic_checkbox_1') || document.querySelector('#basic_checkbox_1');
    if (!checkbox) {
      checkbox = scope.querySelector('input[type="checkbox"]');
    }

    // 2. ค้นหา Label "ปิดงาน" ตาม selector ใน json: div.col-sm-4:nth-of-type(1) > label
    let label = scope.querySelector('div.col-sm-4:nth-of-type(1) > label, div.col-sm-4 > label');
    if (label && label.textContent.includes('ปิดงาน') && isVisible(label)) {
      return { label, checkbox };
    }

    // 3. ค้นหา label[for="basic_checkbox_1"]
    const forCb = scope.querySelector('label[for="basic_checkbox_1"]') || document.querySelector('label[for="basic_checkbox_1"]');
    if (forCb && isVisible(forCb)) {
      return { label: forCb, checkbox };
    }

    // 4. ค้นหา Label ทั้งหมดที่มีคำว่า "ปิดงาน"
    const allLabels = Array.from(scope.querySelectorAll('label')).filter(isVisible);
    const exactLabel = allLabels.find(l => l.textContent.trim() === 'ปิดงาน');
    if (exactLabel) return { label: exactLabel, checkbox };

    const partialLabel = allLabels.find(l => l.textContent.includes('ปิดงาน'));
    if (partialLabel) return { label: partialLabel, checkbox };

    // 5. Fallback หาจาก span/div/a
    const fallbackTextEl = Array.from(scope.querySelectorAll('span, div, a, p'))
      .find(el => isVisible(el) && el.textContent.trim() === 'ปิดงาน');

    return { label: fallbackTextEl || null, checkbox };
  }

  // ============================================================
  // รอให้ Modal เปิดและมีตัวเลือกปิดงานปรากฏ
  // ============================================================
  function waitForPidNganReady(timeout = 12000) {
    return new Promise((resolve) => {
      const check = () => {
        const { label, checkbox } = findPidNganElements();
        if (label || (checkbox && isVisible(checkbox))) {
          return { label, checkbox };
        }
        return null;
      };

      const initial = check();
      if (initial) { resolve(initial); return; }

      const start = Date.now();
      const obs = new MutationObserver(() => {
        const found = check();
        if (found) {
          obs.disconnect();
          resolve(found);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });

      const timer = setInterval(() => {
        const found = check();
        if (found || Date.now() - start > timeout) {
          obs.disconnect();
          clearInterval(timer);
          resolve(found || null);
        }
      }, 200);
    });
  }

  // ============================================================
  // รอให้ Modal ปิดลง
  // ============================================================
  function waitForModalClose(timeout = 7000) {
    return new Promise((resolve) => {
      const isModalOpen = () => {
        const modal = document.querySelector('.modal.in, .modal.show, div.modal:not([style*="display: none"])');
        const cb = document.querySelector('#basic_checkbox_1');
        return isVisible(modal) || isVisible(cb);
      };

      if (!isModalOpen()) { resolve(); return; }

      const start = Date.now();
      const obs = new MutationObserver(() => {
        if (!isModalOpen()) {
          obs.disconnect();
          resolve();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });

      const timer = setInterval(() => {
        if (!isModalOpen() || Date.now() - start > timeout) {
          obs.disconnect();
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  }

  // ============================================================
  // ฟังก์ชันหลักรันอัตโนมัติ
  // ============================================================
  async function runAuto(maxRows, delayMs, triggerMode) {
    stopAutoFlag = false;

    // ล้าง flag แถวที่ทำเสร็จแล้วก่อนหน้า
    document.querySelectorAll('[data-saraban-done]').forEach(el => {
      delete el.dataset.sarabanDone;
      el.style.opacity = '';
      el.style.backgroundColor = '';
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

      // รอให้หน้าเว็บและตารางโหลดเสร็จก่อนเริ่มแถวใหม่
      await waitForLoadingToFinish(4000);

      let currentItems = findRowTriggers(triggerMode);
      if (currentItems.length === 0) {
        // รอเผื่อตารางกำลัง Reload ข้อมูลผ่าน AJAX
        await sleep(1500);
        await waitForLoadingToFinish(3000);
        currentItems = findRowTriggers(triggerMode);
      }

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

      // 1. เลื่อนจอมาที่ปุ่มและคลิกเปิด Modal (คลิกเพียงครั้งเดียว ป้องกัน Double Click Bug)
      const clickable = triggerEl.closest('button, a') || triggerEl;
      clickable.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await sleep(400);
      clickable.click();

      // 2. รอให้ Modal และตัวเลือกปิดงานปรากฏ (สูงสุด 12 วินาที)
      const readyState = await waitForPidNganReady(12000);

      // รอโหลด Overlay / Spinner ใน Modal ให้เสร็จ
      await waitForLoadingToFinish(5000);
      await sleep(2000);

      const { label, checkbox } = findPidNganElements();

      if (!label && !checkbox) {
        if (rowEl && rowEl.dataset) {
          rowEl.dataset.sarabanDone = 'true';
          rowEl.style.opacity = '0.5';
        }
        chrome.runtime.sendMessage({
          action: 'progress', current: processed, total: limit,
          message: `แถวที่ ${i + 1}: ไม่พบตัวเลือกปิดงาน — ข้าม`, warning: true
        }).catch(() => { });
        continue;
      }

      // 3. คลิกที่ Label "ปิดงาน"
      if (label) {
        label.scrollIntoView({ block: 'center', behavior: 'smooth' });
        await sleep(300);
        label.click();
        await sleep(500);
      }

      // 4. ตรวจสอบ Checkbox #basic_checkbox_1 หากยังไม่ได้ติ๊ก ให้คลิกและส่ง event
      const activeCb = checkbox || (findPidNganElements().checkbox);
      if (activeCb && !activeCb.checked) {
        activeCb.click();
        activeCb.checked = true;
        activeCb.dispatchEvent(new Event('change', { bubbles: true }));
        activeCb.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(400);
      }

      // ทำเครื่องหมายว่าแถวนี้ทำแล้ว
      if (rowEl && rowEl.dataset) {
        rowEl.dataset.sarabanDone = 'true';
        rowEl.style.opacity = '0.5';
        rowEl.style.backgroundColor = '#f0fdf4';
      }

      processed++;
      chrome.runtime.sendMessage({
        action: 'progress', current: processed, total: limit,
        message: `ปิดงานแถวที่ ${i + 1} เรียบร้อย`
      }).catch(() => { });

      // 5. รอระบบประมวลผลบันทึกและ Modal ปิดลงอัตโนมัติ
      await waitForModalClose(7000);
      await waitForLoadingToFinish(4000);
      await sleep(1000);

      if (i < limit - 1 && !stopAutoFlag) {
        await sleep(Math.max(delayMs, 1000));
      }
    }

    chrome.runtime.sendMessage({
      action: 'done', processed, total: limit
    }).catch(() => { });
  }

  // ============================================================
  // Message listener
  // ============================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'startAuto') {
      runAuto(msg.maxRows, msg.delayMs, msg.triggerMode || 'edit');
    }
    if (msg.action === 'stopAuto') {
      stopAutoFlag = true;
    }
    return false;
  });
}
