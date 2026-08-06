// ================= [TAB 5] COMMERCE (커머스 관리) 전용 스크립트 =================

let localAccounts = [];
let localExpenses = [];
let editingAccountId = null;
let editingExpenseId = null;
let accountFilterCategory = 'all';

// ---- 초기 데이터 로드 (goal.js의 initializeData 체이닝 방식 흉내) ----
const originalInitializeData_commerce = window.initializeData || async function(){};
window.initializeData = async function() {
    await originalInitializeData_commerce();
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try {
            const uid = currentUser.uid;
            const [aSnap, eSnap] = await Promise.all([
                db.collection("users").doc(uid).collection("accounts").get(),
                db.collection("users").doc(uid).collection("expenses").get()
            ]);
            localAccounts = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localExpenses = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch(e) { console.warn("Commerce 데이터 로드 에러:", e); }
    }
};

// ================= [계정 관리] =================

window.setAccountCategory = function(category) {
    document.querySelectorAll('#account-category-group .pc-day-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.category === category);
    });
}

window.resetAccountModal = function() {
    editingAccountId = null;
    ['account-platform','account-name','account-id','account-url','account-purpose','account-memo'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    window.setAccountCategory('shop');
    const titleH = document.getElementById('account-modal-title');
    const btn = document.getElementById('account-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="user-plus" class="w-5 h-5 mr-2 text-pancake-secondary"></i> 계정 추가';
    if(btn) btn.textContent = '계정 등록';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

window.openEditAccount = function(id) {
    const a = localAccounts.find(x => x.id === id);
    if(!a) return;
    editingAccountId = id;
    window.setAccountCategory(a.category || 'shop');
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
    set('account-platform', a.platform);
    set('account-name', a.name);
    set('account-id', a.account_id);
    set('account-url', a.url);
    set('account-purpose', a.purpose);
    set('account-memo', a.memo);
    const titleH = document.getElementById('account-modal-title');
    const btn = document.getElementById('account-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="pencil" class="w-5 h-5 mr-2 text-pancake-secondary"></i> 계정 수정';
    if(btn) btn.textContent = '변경사항 저장';
    if(typeof lucide !== 'undefined') lucide.createIcons();
    if(typeof openModal !== 'undefined') openModal('add-account-modal');
}

window.saveAccount = async function() {
    try {
        const catBtn = document.querySelector('#account-category-group .pc-day-btn.selected');
        const category = catBtn ? catBtn.dataset.category : 'shop';
        const get = (id) => (document.getElementById(id) ? document.getElementById(id).value.trim() : '');
        const platform = get('account-platform');
        const name = get('account-name');
        const accountId = get('account-id');
        const url = get('account-url');
        const purpose = get('account-purpose');
        const memo = get('account-memo');

        if(!platform || !name) { alert("플랫폼과 계정명은 필수입니다."); return; }

        const isEditing = !!editingAccountId;
        const editId = editingAccountId;

        if(typeof closeModal !== 'undefined') closeModal('add-account-modal');
        window.resetAccountModal();

        if(isEditing) {
            const existing = localAccounts.find(x => x.id === editId);
            if(!existing) { alert("수정할 계정을 찾지 못했습니다."); return; }
            const updates = { category, platform, name, account_id: accountId, url, purpose, memo };
            Object.assign(existing, updates);
            if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
                try { await db.collection("users").doc(currentUser.uid).collection("accounts").doc(editId).update(updates); } catch(e){ console.warn(e); }
            }
            window.renderAccounts();
            if(typeof showToast !== 'undefined') showToast("계정이 수정되었습니다.");
            return;
        }

        const data = { category, platform, name, account_id: accountId, url, purpose, memo, created_at: new Date().toISOString() };
        let newId = 'a_' + Date.now();
        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
            try {
                const docRef = await db.collection("users").doc(currentUser.uid).collection("accounts").add(data);
                newId = docRef.id;
            } catch(e) { console.warn(e); }
        }
        localAccounts.push({ id: newId, ...data });
        window.renderAccounts();
        if(typeof showToast !== 'undefined') showToast("계정이 추가되었습니다.");
    } catch(e) { alert(e.message); }
}

window.deleteAccount = async function(id) {
    if(!confirm("이 계정을 삭제하시겠습니까?")) return;
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try { await db.collection("users").doc(currentUser.uid).collection("accounts").doc(id).delete(); } catch(e){}
    }
    localAccounts = localAccounts.filter(x => x.id !== id);
    window.renderAccounts();
}

window.setAccountFilter = function(category) {
    accountFilterCategory = category;
    window.renderAccounts();
}

window.renderAccounts = function() {
    const container = document.getElementById('account-list-container');
    if(!container) return;
    const filterBar = document.getElementById('account-filter-bar');
    const summaryEl = document.getElementById('account-summary');

    // 필터 바
    if(filterBar) {
        const shopCnt = localAccounts.filter(a => a.category === 'shop').length;
        const blogCnt = localAccounts.filter(a => a.category === 'blog').length;
        filterBar.innerHTML = `
            <button class="quest-filter-chip ${accountFilterCategory==='all'?'selected':''}" onclick="window.setAccountFilter('all')">전체 <span class="text-[9px] opacity-70">(${localAccounts.length})</span></button>
            <button class="quest-filter-chip ${accountFilterCategory==='shop'?'selected':''}" onclick="window.setAccountFilter('shop')">🛒 쇼핑몰 <span class="text-[9px] opacity-70">(${shopCnt})</span></button>
            <button class="quest-filter-chip ${accountFilterCategory==='blog'?'selected':''}" onclick="window.setAccountFilter('blog')">📝 블로그 <span class="text-[9px] opacity-70">(${blogCnt})</span></button>
        `;
    }

    const filtered = accountFilterCategory === 'all' ? localAccounts : localAccounts.filter(a => a.category === accountFilterCategory);
    if(summaryEl) summaryEl.textContent = `표시 중: ${filtered.length}개`;

    if(filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-8 font-bold">아직 등록된 계정이 없어요. [+ 계정 추가] 버튼으로 시작해보세요.</div>';
        return;
    }

    // 카테고리별 그룹 → 플랫폼별 정렬
    const sorted = filtered.slice().sort((a,b) => {
        if((a.category||'') !== (b.category||'')) return (a.category||'').localeCompare(b.category||'');
        return (a.platform||'').localeCompare(b.platform||'');
    });

    container.innerHTML = sorted.map(a => {
        const catIcon = a.category === 'blog' ? '📝' : '🛒';
        const urlPart = a.url ? `<a href="${a.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-[10px] text-pancake-primary font-bold hover:underline flex items-center gap-0.5 mt-0.5"><i data-lucide="external-link" class="w-2.5 h-2.5"></i> ${a.url.replace(/^https?:\/\//,'').split('/')[0]}</a>` : '';
        const idPart = a.account_id ? `<span class="text-[10px] text-gray-500 font-bold">ID: ${a.account_id}</span>` : '';
        const purposePart = a.purpose ? `<span class="quest-priority-badge quest-priority-medium">${a.purpose}</span>` : '';
        const memoPart = a.memo ? `<div class="text-[10px] text-gray-400 mt-1 leading-snug break-words">${a.memo}</div>` : '';
        return `
        <div class="flex justify-between items-start gap-2 p-2.5 bg-white rounded-lg border border-gray-200 hover:border-pancake-primary/50 transition">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-sm">${catIcon}</span>
                    <span class="text-sm font-bold text-pancake-text">${a.platform}</span>
                    <span class="text-xs font-bold text-gray-500">· ${a.name}</span>
                    ${purposePart}
                </div>
                <div class="flex items-center gap-2 flex-wrap mt-0.5">
                    ${idPart}
                    ${urlPart}
                </div>
                ${memoPart}
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
                <button onclick="window.openEditAccount('${a.id}')" class="text-gray-400 hover:text-pancake-primary p-1" title="수정"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                <button onclick="window.deleteAccount('${a.id}')" class="text-gray-400 hover:text-pancake-failure p-1" title="삭제"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>
    `;
    }).join('');
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [경비 기록] =================

window.resetExpenseModal = function() {
    editingExpenseId = null;
    const today = new Date().toISOString().split('T')[0];
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    set('expense-date', today);
    set('expense-amount', '');
    set('expense-category', '체험단');
    set('expense-target', '');
    set('expense-brand', '');
    set('expense-payment', '사업용카드');
    set('expense-receipt', 'none');
    set('expense-memo', '');
    const titleH = document.getElementById('expense-modal-title');
    const btn = document.getElementById('expense-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="receipt" class="w-5 h-5 mr-2 text-pancake-warning"></i> 지출 추가';
    if(btn) btn.textContent = '지출 기록';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

window.openEditExpense = function(id) {
    const e = localExpenses.find(x => x.id === id);
    if(!e) return;
    editingExpenseId = id;
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
    set('expense-date', e.date);
    set('expense-amount', e.amount);
    set('expense-category', e.category);
    set('expense-target', e.target);
    set('expense-brand', e.brand);
    set('expense-payment', e.payment_method || '사업용카드');
    set('expense-receipt', e.receipt || 'none');
    set('expense-memo', e.memo);
    const titleH = document.getElementById('expense-modal-title');
    const btn = document.getElementById('expense-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="pencil" class="w-5 h-5 mr-2 text-pancake-warning"></i> 지출 수정';
    if(btn) btn.textContent = '변경사항 저장';
    if(typeof lucide !== 'undefined') lucide.createIcons();
    if(typeof openModal !== 'undefined') openModal('add-expense-modal');
}

window.saveExpense = async function() {
    try {
        const get = (id) => (document.getElementById(id) ? document.getElementById(id).value : '');
        const date = get('expense-date');
        const amount = parseInt(get('expense-amount'));
        const category = get('expense-category');
        const target = get('expense-target').trim();
        const brand = get('expense-brand').trim();
        const payment_method = get('expense-payment');
        const receipt = get('expense-receipt');
        const memo = get('expense-memo').trim();

        if(!date) { alert("지출일을 선택해주세요."); return; }
        if(isNaN(amount) || amount <= 0) { alert("금액을 올바르게 입력해주세요."); return; }
        if(!target) { alert("지출처를 입력해주세요."); return; }

        const isEditing = !!editingExpenseId;
        const editId = editingExpenseId;

        if(typeof closeModal !== 'undefined') closeModal('add-expense-modal');
        window.resetExpenseModal();

        if(isEditing) {
            const existing = localExpenses.find(x => x.id === editId);
            if(!existing) { alert("수정할 지출을 찾지 못했습니다."); return; }
            const updates = { date, amount, category, target, brand, payment_method, receipt, memo };
            Object.assign(existing, updates);
            if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
                try { await db.collection("users").doc(currentUser.uid).collection("expenses").doc(editId).update(updates); } catch(e){ console.warn(e); }
            }
            window.renderExpenses();
            if(typeof showToast !== 'undefined') showToast("지출이 수정되었습니다.");
            return;
        }

        const data = { date, amount, category, target, brand, payment_method, receipt, memo, created_at: new Date().toISOString() };
        let newId = 'e_' + Date.now();
        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
            try {
                const docRef = await db.collection("users").doc(currentUser.uid).collection("expenses").add(data);
                newId = docRef.id;
            } catch(e) { console.warn(e); }
        }
        localExpenses.push({ id: newId, ...data });
        window.renderExpenses();
        if(typeof showToast !== 'undefined') showToast("지출이 기록되었습니다.");
    } catch(e) { alert(e.message); }
}

window.deleteExpense = async function(id) {
    if(!confirm("이 지출 기록을 삭제하시겠습니까?")) return;
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try { await db.collection("users").doc(currentUser.uid).collection("expenses").doc(id).delete(); } catch(e){}
    }
    localExpenses = localExpenses.filter(x => x.id !== id);
    window.renderExpenses();
}

window.formatKRW = function(n) {
    if(typeof n !== 'number' || isNaN(n)) return '0원';
    return n.toLocaleString('ko-KR') + '원';
}

window.getExpenseCategoryColor = function(cat) {
    const map = {
        '체험단': 'quest-priority-high',
        '광고': 'quest-priority-high',
        '매입': 'quest-priority-medium',
        '배송': 'quest-priority-low',
        '수수료': 'quest-priority-low',
        '세금': 'quest-priority-high',
        '소모품': 'quest-priority-low',
        '구독': 'quest-priority-low',
        '기타': 'quest-priority-low'
    };
    return map[cat] || 'quest-priority-low';
}

window.renderExpenses = function() {
    const container = document.getElementById('expense-list-container');
    const summaryContainer = document.getElementById('expense-summary-container');
    const monthPicker = document.getElementById('expense-month-picker');
    const brandFilterEl = document.getElementById('expense-brand-filter');
    if(!container) return;

    // 월 선택기 초기값
    if(monthPicker && !monthPicker.value) {
        const now = new Date();
        monthPicker.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }
    const selectedMonth = monthPicker ? monthPicker.value : '';

    // 브랜드 필터 옵션 갱신
    if(brandFilterEl) {
        const currentBrand = brandFilterEl.value;
        const brandSet = new Set(localExpenses.map(x => (x.brand || '').trim()).filter(x => x));
        const brands = Array.from(brandSet).sort();
        brandFilterEl.innerHTML = '<option value="all">전체 브랜드</option>' +
            brands.map(b => `<option value="${b}">${b}</option>`).join('');
        if(brands.includes(currentBrand) || currentBrand === 'all') brandFilterEl.value = currentBrand;
        else brandFilterEl.value = 'all';
    }
    const selectedBrand = brandFilterEl ? brandFilterEl.value : 'all';

    // 필터링
    let filtered = localExpenses.slice();
    if(selectedMonth) filtered = filtered.filter(x => (x.date || '').startsWith(selectedMonth));
    if(selectedBrand && selectedBrand !== 'all') filtered = filtered.filter(x => (x.brand || '') === selectedBrand);

    // 요약 카드: 이번 달 합계 + 카테고리별
    if(summaryContainer) {
        const total = filtered.reduce((s, x) => s + (x.amount || 0), 0);
        const byCat = {};
        filtered.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + (x.amount || 0); });
        const catEntries = Object.entries(byCat).sort((a,b) => b[1] - a[1]);

        // 지난달 비교
        let prevMonthStr = '';
        if(selectedMonth) {
            const [y,m] = selectedMonth.split('-').map(Number);
            const prev = new Date(y, m - 2, 1);
            prevMonthStr = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
        }
        let prevMonthTotal = 0;
        if(prevMonthStr) {
            let prevFiltered = localExpenses.filter(x => (x.date || '').startsWith(prevMonthStr));
            if(selectedBrand && selectedBrand !== 'all') prevFiltered = prevFiltered.filter(x => (x.brand || '') === selectedBrand);
            prevMonthTotal = prevFiltered.reduce((s, x) => s + (x.amount || 0), 0);
        }
        let deltaHtml = '';
        if(prevMonthTotal > 0) {
            const diff = total - prevMonthTotal;
            const pct = Math.round((diff / prevMonthTotal) * 100);
            const isUp = diff > 0;
            deltaHtml = `<span class="text-[10px] font-bold ${isUp ? 'text-pancake-failure' : 'text-pancake-success'}">지난달 대비 ${isUp ? '▲' : '▼'} ${Math.abs(pct)}%</span>`;
        }

        const catBadges = catEntries.length > 0
            ? catEntries.map(([cat, amt]) => {
                const pct = total > 0 ? Math.round((amt/total)*100) : 0;
                return `<div class="flex items-center justify-between p-1.5 bg-white rounded-md border border-gray-100">
                    <span class="quest-priority-badge ${window.getExpenseCategoryColor(cat)}">${cat}</span>
                    <div class="text-right">
                        <div class="text-xs font-bold text-pancake-text">${window.formatKRW(amt)}</div>
                        <div class="text-[9px] text-gray-400 font-bold">${pct}%</div>
                    </div>
                </div>`;
            }).join('')
            : '<div class="text-[10px] text-gray-400 font-bold text-center py-2">이 조건의 지출이 없어요</div>';

        summaryContainer.innerHTML = `
            <div class="p-4 bg-gradient-to-br from-[#FFF9E6] to-white rounded-xl border border-yellow-100">
                <div class="flex items-baseline justify-between mb-1">
                    <span class="text-[10px] font-bold text-gray-500">${selectedMonth ? selectedMonth.replace('-', '년 ') + '월' : '전체'} ${selectedBrand !== 'all' ? '· ' + selectedBrand : ''} 지출 합계</span>
                    ${deltaHtml}
                </div>
                <div class="text-2xl font-black text-pancake-text mb-3">${window.formatKRW(total)}</div>
                <div class="grid grid-cols-2 gap-1.5">${catBadges}</div>
            </div>
        `;
    }

    // 목록: 최신순
    filtered.sort((a,b) => (b.date || '').localeCompare(a.date || '') || (b.created_at||'').localeCompare(a.created_at||''));

    if(filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-8 font-bold">이 달의 지출 기록이 없어요.</div>';
        return;
    }

    container.innerHTML = filtered.map(e => {
        const brandPart = e.brand ? `<span class="text-[10px] font-bold text-gray-500">· ${e.brand}</span>` : '';
        const receiptMap = { none: '증빙없음', card: '카드매출전표', tax: '세금계산서', cash: '현금영수증', simple: '간이영수증' };
        const receiptLabel = receiptMap[e.receipt || 'none'];
        const receiptCls = (e.receipt && e.receipt !== 'none') ? 'text-pancake-success' : 'text-gray-400';
        const memoPart = e.memo ? `<div class="text-[10px] text-gray-400 mt-1 leading-snug break-words">${e.memo}</div>` : '';
        return `
        <div class="flex justify-between items-start gap-2 p-2.5 bg-white rounded-lg border border-gray-200 hover:border-pancake-warning/50 transition">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap mb-1">
                    <span class="text-[10px] font-bold text-gray-400">${e.date}</span>
                    <span class="quest-priority-badge ${window.getExpenseCategoryColor(e.category)}">${e.category}</span>
                    ${brandPart}
                </div>
                <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="text-sm font-bold text-pancake-text">${e.target}</span>
                    <span class="text-sm font-black text-pancake-failure">${window.formatKRW(e.amount)}</span>
                </div>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <span class="text-[10px] font-bold text-gray-400">${e.payment_method || ''}</span>
                    <span class="text-[10px] font-bold ${receiptCls}">${receiptLabel}</span>
                </div>
                ${memoPart}
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
                <button onclick="window.openEditExpense('${e.id}')" class="text-gray-400 hover:text-pancake-primary p-1" title="수정"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                <button onclick="window.deleteExpense('${e.id}')" class="text-gray-400 hover:text-pancake-failure p-1" title="삭제"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>
    `;
    }).join('');
    if(typeof lucide !== 'undefined') lucide.createIcons();
}
