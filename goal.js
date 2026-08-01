// ================= [TAB 4] GOAL (목표관리) 전용 스크립트 =================

let localTopGoals = [];
let localQuests = [];
let localRoutines = [];
let localMilestones = [];

// 1. 기존 탭 전환 기능
window.switchMainTab = function(id) { 
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active')); 
    if (window.event && window.event.target) window.event.target.classList.add('active'); 
    document.getElementById(id).classList.add('active'); 
    
    if(id==='tab1') safeCall(initTab1Charts); 
    if(id==='tab2') { safeCall(initJournalDates); safeCall(renderJournals); }
    if(id==='tab3') safeCall(renderNotes); 
    if(id==='tab4') { 
        safeCall(window.renderTopGoals); 
        safeCall(window.renderQuests); 
        safeCall(window.renderRoutines); 
        safeCall(window.updateDropdowns); 
        safeCall(window.renderTodayChecklist);
    }
}

// 2. 데이터 불러오기 기능
const originalInitializeData = window.initializeData || async function(){};
window.initializeData = async function() {
    await originalInitializeData(); 
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try {
            const uid = currentUser.uid;
            const [gSnap, qSnap, rSnap, mSnap] = await Promise.all([
                db.collection("users").doc(uid).collection("top_goals").orderBy("created_at").get(),
                db.collection("users").doc(uid).collection("quests").get(),
                db.collection("users").doc(uid).collection("routines").get(),
                db.collection("users").doc(uid).collection("milestones").get()
            ]);
            localTopGoals = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localQuests = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localRoutines = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localMilestones = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch(e) { console.warn("Goal 데이터 로드 에러 (로컬 캐시 사용):", e); }
    }
};

window.updateDropdowns = function() {
    const questSelect = document.getElementById('quest-parent');
    const routineSelect = document.getElementById('routine-parent');
    if(!questSelect || !routineSelect) return;
    
    let optionsHtml = '';
    if(localTopGoals.length === 0) {
        optionsHtml = '<option value="">최상위 목표를 먼저 만들어주세요!</option>';
    } else {
        localTopGoals.forEach(g => {
            optionsHtml += `<option value="${g.id}">${g.icon} ${g.title}</option>`;
        });
    }
    questSelect.innerHTML = optionsHtml;
    routineSelect.innerHTML = optionsHtml;
}

// ================= [공통 헬퍼: D-day, 반복요일] =================

window.getDdayInfo = function(deadlineStr) {
    if(!deadlineStr) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const deadline = new Date(deadlineStr + 'T00:00:00');
    if(isNaN(deadline.getTime())) return null;
    const diffDays = Math.round((deadline - today) / 86400000);
    if(diffDays > 0) return { label: `D-${diffDays}`, overdue: false };
    if(diffDays === 0) return { label: 'D-DAY', overdue: false };
    return { label: `기한초과 D+${Math.abs(diffDays)}`, overdue: true };
}

window.isRoutineDueToday = function(routine) {
    if(!routine.repeat_days || !Array.isArray(routine.repeat_days) || routine.repeat_days.length === 0) return true; // 기존 루틴(매일) 하위호환
    return routine.repeat_days.includes(new Date().getDay());
}

window.formatRepeatDays = function(days) {
    if(!days || !Array.isArray(days) || days.length === 0 || days.length === 7) return '매일';
    const labels = ['일','월','화','수','목','금','토'];
    return days.slice().sort((a,b)=>a-b).map(d => labels[d]).join('·');
}

window.toggleDayBtn = function(el) {
    el.classList.toggle('selected');
}
window.setAllDays = function(select) {
    document.querySelectorAll('#routine-repeat-days .pc-day-btn').forEach(btn => {
        if(select) btn.classList.add('selected'); else btn.classList.remove('selected');
    });
}
window.resetRoutineModal = function() {
    window.setAllDays(true);
}

// ================= [최상위 목표 (Top Goals) 기능] =================

window.addTopGoal = async function() {
    try {
        const titleEl = document.getElementById('top-goal-title');
        const iconEl = document.getElementById('top-goal-icon');
        const colorEl = document.getElementById('top-goal-color');
        const expEl = document.getElementById('top-goal-max-exp');
        const deadlineEl = document.getElementById('top-goal-deadline');

        const title = titleEl.value.trim();
        const icon = iconEl.value.trim() || '🎯'; 
        const color = colorEl.value;
        const maxExp = parseInt(expEl.value);
        const deadline = deadlineEl ? deadlineEl.value : '';

        if(!title || isNaN(maxExp) || maxExp <= 0) {
            alert("목표 이름과 경험치를 올바르게 입력해주세요."); return;
        }

        // 1. 모달부터 무조건 닫기 (오류로 인한 화면 멈춤 원천 방지)
        titleEl.value = ''; iconEl.value = ''; expEl.value = ''; if(deadlineEl) deadlineEl.value = '';
        if(typeof closeModal !== 'undefined') closeModal('add-top-goal-modal');

        const goalData = { title, icon, color, max_exp: maxExp, current_exp: 0, created_at: new Date().toISOString(), deadline: deadline || '' };
        let newId = 'g_' + Date.now();

        // 2. 파이어베이스 저장 시도 (실패해도 화면에는 뜨도록 처리)
        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
            try {
                const docRef = await db.collection("users").doc(currentUser.uid).collection("top_goals").add(goalData);
                newId = docRef.id;
            } catch(fbErr) {
                console.warn("DB 권한 오류 - 화면에만 먼저 표시합니다.", fbErr);
            }
        }
        
        // 3. 화면 업데이트
        localTopGoals.push({ id: newId, ...goalData });
        window.renderTopGoals(); window.updateDropdowns();
        if(typeof showToast !== 'undefined') showToast("목표가 생성되었습니다!");
        
    } catch (e) {
        alert("버튼 기능에 오류가 있습니다: " + e.message);
    }
}

window.deleteTopGoal = async function(id) {
    if(!confirm("이 목표를 삭제하시겠습니까?")) return;
    try {
        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
            await db.collection("users").doc(currentUser.uid).collection("top_goals").doc(id).delete(); 
        }
    } catch(e) { console.warn(e); }
    localTopGoals = localTopGoals.filter(g => g.id !== id);
    localMilestones = localMilestones.filter(m => m.parent_goal_id !== id);
    window.renderTopGoals(); window.updateDropdowns(); window.renderQuests(); window.renderRoutines(); window.renderTodayChecklist();
    if(typeof showToast !== 'undefined') showToast("목표가 삭제되었습니다.");
}

window.renderTopGoals = function() {
    const container = document.getElementById('top-goals-container');
    if(!container) return;
    container.innerHTML = '';

    if(localTopGoals.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-sm text-gray-400 py-10 font-bold border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">우측 상단의 [+ 목표 추가] 버튼을 눌러 목표를 세워보세요!</div>';
        return;
    }

    localTopGoals.forEach(goal => {
        let progress = Math.floor((goal.current_exp / goal.max_exp) * 100);
        if(progress > 100) progress = 100;
        let level = Math.floor((goal.current_exp / goal.max_exp) * 99) + 1;
        if(level > 100) level = 100;

        const dday = window.getDdayInfo(goal.deadline);
        const ddayHtml = dday ? `<span class="dday-badge ${dday.overdue ? 'overdue' : ''}"><i data-lucide="calendar" class="w-3 h-3 inline -mt-0.5 mr-1"></i>${dday.label}</span>` : '';

        const goalMilestones = localMilestones.filter(m => m.parent_goal_id === goal.id).sort((a,b) => a.target_exp - b.target_exp);
        const flagsHtml = goalMilestones.map(m => {
            const pct = Math.min(100, Math.max(0, (m.target_exp / goal.max_exp) * 100));
            return `<div class="milestone-flag" style="left:${pct}%;" title="${m.title} (${m.target_exp} EXP)">${m.achieved ? '🚩' : '🏳️'}</div>`;
        }).join('');
        const chipsHtml = goalMilestones.length > 0 ? goalMilestones.map(m => `
            <span class="milestone-chip ${m.achieved ? 'achieved' : ''}">${m.achieved ? '✅' : '⬜'} ${m.title}<button onclick="window.deleteMilestone('${m.id}')" class="ml-1 text-gray-400 hover:text-pancake-failure">×</button></span>
        `).join('') : '<span class="text-[10px] text-gray-300 font-bold">설정된 마일스톤이 없어요</span>';

        container.innerHTML += `
            <div class="pc-card border-t-4 border-pancake-${goal.color} hover:-translate-y-1 transition duration-300 relative group">
                <button onclick="window.deleteTopGoal('${goal.id}')" class="absolute top-4 right-4 text-gray-300 hover:text-pancake-failure opacity-0 group-hover:opacity-100 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                <div class="flex items-center gap-3 mb-2 pr-6">
                    <div class="text-3xl">${goal.icon}</div>
                    <div>
                        <h3 class="font-bold text-lg text-pancake-text leading-tight">${goal.title}</h3>
                        ${ddayHtml ? `<div class="mt-1">${ddayHtml}</div>` : ''}
                    </div>
                </div>
                <div class="flex justify-between items-end mb-1 mt-4">
                    <span class="text-sm font-brand font-bold text-pancake-${goal.color}">Lv. ${level}</span>
                    <span class="text-[10px] font-bold text-gray-400">${goal.current_exp} / ${goal.max_exp} EXP</span>
                </div>
                <div class="relative">
                    <div class="w-full bg-gray-100 rounded-full h-3 mb-1 overflow-hidden border border-gray-200">
                        <div class="bg-pancake-${goal.color} h-full rounded-full transition-all duration-700" style="width: ${progress}%"></div>
                    </div>
                    ${flagsHtml}
                </div>
                <div class="text-right text-[10px] font-bold text-gray-400 mb-3">${progress}% 진행됨</div>
                <div class="pt-3 border-t border-gray-100">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-bold text-gray-400 flex items-center"><i data-lucide="flag" class="w-3 h-3 mr-1"></i> 마일스톤</span>
                        <button onclick="window.openAddMilestoneModal('${goal.id}')" class="text-[10px] font-bold text-pancake-primary hover:underline">+ 추가</button>
                    </div>
                    <div class="flex flex-wrap gap-1.5">${chipsHtml}</div>
                </div>
            </div>
        `;
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [마일스톤 (Milestones) 기능] =================

window.openAddMilestoneModal = function(goalId) {
    const goal = localTopGoals.find(g => g.id === goalId);
    if(!goal) return;
    const parentIdEl = document.getElementById('milestone-parent-id');
    const nameLabel = document.getElementById('milestone-parent-name');
    if(parentIdEl) parentIdEl.value = goalId;
    if(nameLabel) nameLabel.textContent = `${goal.icon} ${goal.title} 목표에 추가됩니다`;
    if(typeof openModal !== 'undefined') openModal('add-milestone-modal');
}

window.addMilestone = async function() {
    try {
        const goalId = document.getElementById('milestone-parent-id').value;
        const titleEl = document.getElementById('milestone-title');
        const expEl = document.getElementById('milestone-target-exp');
        const title = titleEl.value.trim();
        const targetExp = parseInt(expEl.value);

        const parentGoal = localTopGoals.find(g => g.id === goalId);
        if(!parentGoal) { alert("목표를 찾을 수 없습니다."); return; }
        if(!title || isNaN(targetExp) || targetExp <= 0) { alert("마일스톤 이름과 목표 경험치를 올바르게 입력해주세요."); return; }
        if(targetExp > parentGoal.max_exp) { alert(`목표 경험치는 이 목표의 최대 경험치(${parentGoal.max_exp})를 넘을 수 없습니다.`); return; }

        titleEl.value = ''; expEl.value = '';
        if(typeof closeModal !== 'undefined') closeModal('add-milestone-modal');

        const achievedNow = parentGoal.current_exp >= targetExp;
        const msData = { parent_goal_id: goalId, title, target_exp: targetExp, achieved: achievedNow, achieved_at: achievedNow ? new Date().toISOString() : '' };
        let newId = 'm_' + Date.now();

        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
            try {
                const docRef = await db.collection("users").doc(currentUser.uid).collection("milestones").add(msData);
                newId = docRef.id;
            } catch(e) { console.warn(e); }
        }

        localMilestones.push({ id: newId, ...msData });
        window.renderTopGoals();
        if(typeof showToast !== 'undefined') showToast("마일스톤이 추가되었습니다!");
    } catch(e) { alert(e.message); }
}

window.deleteMilestone = async function(id) {
    if(!confirm("이 마일스톤을 삭제하시겠습니까?")) return;
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try { await db.collection("users").doc(currentUser.uid).collection("milestones").doc(id).delete(); } catch(e){}
    }
    localMilestones = localMilestones.filter(m => m.id !== id);
    window.renderTopGoals();
}

window.checkMilestones = async function(goalId, currentExp) {
    const related = localMilestones.filter(m => m.parent_goal_id === goalId);
    for (const m of related) {
        if (!m.achieved && currentExp >= m.target_exp) {
            m.achieved = true;
            m.achieved_at = new Date().toISOString();
            if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
                try { await db.collection("users").doc(currentUser.uid).collection("milestones").doc(m.id).update({ achieved: true, achieved_at: m.achieved_at }); } catch(e){ console.warn(e); }
            }
            window.showMilestoneCelebration(m.title);
        } else if (m.achieved && currentExp < m.target_exp) {
            // 루틴 취소 등으로 경험치가 기준 밑으로 내려간 경우 조용히 되돌림 (축하 팝업 없음)
            m.achieved = false;
            m.achieved_at = '';
            if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
                try { await db.collection("users").doc(currentUser.uid).collection("milestones").doc(m.id).update({ achieved: false, achieved_at: '' }); } catch(e){ console.warn(e); }
            }
        }
    }
    window.renderTopGoals();
}

window.showMilestoneCelebration = function(title) {
    const backdrop = document.createElement('div');
    backdrop.className = 'milestone-celebrate-backdrop';
    backdrop.innerHTML = `
        <div class="milestone-celebrate-card">
            <div class="text-5xl mb-3">🚩</div>
            <div class="text-sm font-bold text-pancake-textSub mb-1">마일스톤 달성!</div>
            <div class="text-xl font-black text-pancake-text">${title}</div>
        </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', () => backdrop.remove());
    setTimeout(() => { if(backdrop && backdrop.parentNode) backdrop.remove(); }, 2200);
    if(typeof showToast !== 'undefined') showToast(`🚩 마일스톤 달성: ${title}`);
}

// ================= [오늘의 통합 체크리스트] =================

window.renderTodayChecklist = function() {
    const container = document.getElementById('today-checklist-container');
    const summaryEl = document.getElementById('today-checklist-summary');
    const barEl = document.getElementById('today-checklist-bar');
    if(!container) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const dueRoutines = localRoutines.filter(r => window.isRoutineDueToday(r));
    const items = [];

    dueRoutines.forEach(r => {
        const parentGoal = localTopGoals.find(g => g.id === r.parent_goal_id);
        items.push({
            type: 'routine', id: r.id,
            done: r.last_completed_date === todayStr,
            label: r.routine_name,
            sub: parentGoal ? `${parentGoal.icon} ${parentGoal.title}` : '연결된 목표 없음',
            meta: `+${r.exp_reward} EXP`
        });
    });
    localQuests.forEach(q => {
        const parentGoal = localTopGoals.find(g => g.id === q.parent_goal_id);
        items.push({
            type: 'quest', id: q.id,
            done: q.is_completed,
            rawDone: q.is_completed,
            label: q.task_name,
            sub: parentGoal ? `${parentGoal.icon} ${parentGoal.title}` : '연결된 목표 없음',
            meta: '퀘스트'
        });
    });

    const total = items.length;
    const doneCount = items.filter(i => i.done).length;
    if(summaryEl) summaryEl.textContent = `${doneCount} / ${total} 완료`;
    if(barEl) barEl.style.width = total > 0 ? `${Math.round(doneCount/total*100)}%` : '0%';

    if(total === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-8 font-bold">오늘 예정된 루틴이나 퀘스트가 없습니다. 목표를 세우고 루틴/퀘스트를 추가해보세요!</div>';
        return;
    }

    items.sort((a,b) => (a.done === b.done) ? 0 : (a.done ? 1 : -1));

    container.innerHTML = items.map(item => `
        <div class="flex justify-between items-center p-2.5 bg-white rounded-lg border ${item.done ? 'border-gray-100' : 'border-gray-200'} shadow-sm ${item.done ? 'today-item-done' : ''}">
            <div class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0" onclick="${item.type==='routine' ? `window.toggleRoutine('${item.id}')` : `window.toggleQuest('${item.id}', ${item.rawDone})`}">
                <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? 'bg-pancake-success border-pancake-success text-white' : 'border-gray-300'}">
                    ${item.done ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}
                </div>
                <div class="min-w-0">
                    <div class="text-sm font-bold truncate ${item.done ? 'text-gray-400 line-through' : 'text-pancake-text'}">${item.type==='routine' ? '🌱' : '📋'} ${item.label}</div>
                    <div class="text-[10px] text-gray-400 font-bold truncate">${item.sub}</div>
                </div>
            </div>
            <span class="text-[10px] font-bold text-gray-400 shrink-0 pl-2">${item.meta}</span>
        </div>
    `).join('');
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [퀘스트 (Quests) 기능] =================

window.addQuest = async function() {
    try {
        const parentId = document.getElementById('quest-parent').value;
        const taskNameEl = document.getElementById('quest-name');
        const taskName = taskNameEl.value.trim();
        
        if(!parentId || !taskName) return alert("목표를 선택하고 내용을 입력하세요.");

        // 무조건 창부터 닫기
        taskNameEl.value = '';
        if(typeof closeModal !== 'undefined') closeModal('add-quest-modal');

        const questData = { parent_goal_id: parentId, task_name: taskName, is_completed: false, created_at: new Date().toISOString() };
        let newId = 'q_' + Date.now();
        
        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
            try {
                const docRef = await db.collection("users").doc(currentUser.uid).collection("quests").add(questData);
                newId = docRef.id;
            } catch(e) { console.warn(e); }
        }
        
        localQuests.push({ id: newId, ...questData });
        window.renderQuests(); 
        window.renderTodayChecklist();
        if(typeof showToast !== 'undefined') showToast("퀘스트 추가 완료!");
    } catch(e) { alert(e.message); }
}

window.toggleQuest = async function(id, currentStatus) {
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        try { await db.collection("users").doc(currentUser.uid).collection("quests").doc(id).update({ is_completed: !currentStatus }); } catch(e){}
    }
    const quest = localQuests.find(q => q.id === id);
    if(quest) quest.is_completed = !currentStatus;
    window.renderQuests();
    window.renderTodayChecklist();
}

window.deleteQuest = async function(id) {
    if(!confirm("퀘스트를 삭제하시겠습니까?")) return;
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        try { await db.collection("users").doc(currentUser.uid).collection("quests").doc(id).delete(); } catch(e){}
    }
    localQuests = localQuests.filter(q => q.id !== id);
    window.renderQuests();
    window.renderTodayChecklist();
}

window.renderQuests = function() {
    const container = document.getElementById('quest-board-container');
    if(!container) return;
    container.innerHTML = '';

    if (localQuests.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-6 font-bold">등록된 퀘스트가 없습니다.</div>';
        return;
    }

    localTopGoals.forEach(goal => {
        const quests = localQuests.filter(q => q.parent_goal_id === goal.id);
        if(quests.length === 0) return;

        let html = `<div class="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100"><h4 class="text-xs font-bold text-pancake-text mb-2 flex items-center">${goal.icon} ${goal.title}</h4>`;
        quests.forEach(q => {
            const isDone = q.is_completed;
            html += `
                <div class="flex justify-between items-center p-2 mb-2 bg-white rounded-lg border border-gray-200 shadow-sm transition hover:border-pancake-primary/50">
                    <div class="flex items-center gap-2 cursor-pointer flex-1" onclick="window.toggleQuest('${q.id}', ${isDone})">
                        <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${isDone ? 'bg-pancake-success border-pancake-success text-white' : 'border-gray-300'}">
                            ${isDone ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}
                        </div>
                        <span class="text-sm font-bold ${isDone ? 'text-gray-400 line-through' : 'text-pancake-text'}">${q.task_name}</span>
                    </div>
                    <button onclick="window.deleteQuest('${q.id}')" class="text-gray-400 hover:text-pancake-failure p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML += html;
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [데일리 루틴 (Routines) 및 경험치 로직] =================

window.addRoutine = async function() {
    try {
        const parentId = document.getElementById('routine-parent').value;
        const nameEl = document.getElementById('routine-name');
        const expEl = document.getElementById('routine-exp');
        
        const name = nameEl.value.trim();
        const expReward = parseInt(expEl.value);

        if(!parentId || !name || isNaN(expReward) || expReward <= 0) return alert("올바르게 채워주세요.");

        const selectedDayEls = document.querySelectorAll('#routine-repeat-days .pc-day-btn.selected');
        const repeatDays = Array.from(selectedDayEls).map(el => parseInt(el.dataset.day)).sort((a,b)=>a-b);
        if(repeatDays.length === 0) return alert("반복할 요일을 최소 하루 이상 선택해주세요.");

        nameEl.value = ''; expEl.value = '';
        window.setAllDays(true);
        if(typeof closeModal !== 'undefined') closeModal('add-routine-modal');

        const routineData = { parent_goal_id: parentId, routine_name: name, exp_reward: expReward, streak_count: 0, last_completed_date: '', repeat_days: repeatDays };
        let newId = 'r_' + Date.now();
        
        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
            try {
                const docRef = await db.collection("users").doc(currentUser.uid).collection("routines").add(routineData);
                newId = docRef.id;
            } catch(e) { console.warn(e); }
        }
        
        localRoutines.push({ id: newId, ...routineData });
        window.renderRoutines(); 
        window.renderTodayChecklist();
        if(typeof showToast !== 'undefined') showToast("루틴 생성 완료!");
    } catch(e) { alert(e.message); }
}

window.toggleRoutine = async function(id) {
    const routine = localRoutines.find(r => r.id === id);
    if(!routine) return;

    if(!window.isRoutineDueToday(routine)) {
        if(typeof showToast !== 'undefined') showToast("오늘은 이 루틴을 수행하는 날이 아니에요.");
        return;
    }

    const parentGoal = localTopGoals.find(g => g.id === routine.parent_goal_id);
    if(!parentGoal) return alert("연결된 목표가 삭제되어 경험치를 올릴 수 없습니다.");

    const todayStr = new Date().toISOString().split('T')[0];
    const isDoneToday = routine.last_completed_date === todayStr;

    let newStreak = routine.streak_count || 0;
    let newDate = routine.last_completed_date || '';
    let expChange = 0;

    if (isDoneToday) { 
        newStreak = Math.max(0, newStreak - 1); 
        newDate = ''; 
        expChange = -(routine.exp_reward || 0);
    } else { 
        newStreak += 1; 
        newDate = todayStr; 
        expChange = routine.exp_reward || 0;
    }

    let newGoalExp = Math.max(0, parentGoal.current_exp + expChange);

    routine.streak_count = newStreak;
    routine.last_completed_date = newDate;
    parentGoal.current_exp = newGoalExp;

    window.renderRoutines();
    window.renderTopGoals();
    window.renderTodayChecklist();

    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        try {
            await db.collection("users").doc(currentUser.uid).collection("routines").doc(id).update({ streak_count: newStreak, last_completed_date: newDate }); 
            await db.collection("users").doc(currentUser.uid).collection("top_goals").doc(parentGoal.id).update({ current_exp: newGoalExp });
        } catch(e){ console.warn(e); }
    }

    if(!isDoneToday && typeof showToast !== 'undefined') showToast(`🎉 루틴 달성! (+${routine.exp_reward} EXP 획득)`);

    window.checkMilestones(parentGoal.id, newGoalExp);
}

window.deleteRoutine = async function(id) {
    if(!confirm("루틴을 삭제하시겠습니까?")) return;
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        try { await db.collection("users").doc(currentUser.uid).collection("routines").doc(id).delete(); } catch(e){}
    }
    localRoutines = localRoutines.filter(r => r.id !== id);
    window.renderRoutines();
    window.renderTodayChecklist();
}

window.renderRoutines = function() {
    const container = document.getElementById('daily-routine-container');
    if(!container) return;
    container.innerHTML = '';
    
    if (localRoutines.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-6 font-bold">등록된 데일리 루틴이 없습니다.</div>';
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    localRoutines.forEach(r => {
        const isDueToday = window.isRoutineDueToday(r);
        const isDone = r.last_completed_date === todayStr;
        const parentGoal = localTopGoals.find(g => g.id === r.parent_goal_id);
        const goalIcon = parentGoal ? parentGoal.icon : '❓';
        const repeatLabel = window.formatRepeatDays(r.repeat_days);

        if(!isDueToday) {
            container.innerHTML += `
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 opacity-60">
                    <div class="flex items-center gap-3 flex-1">
                        <div class="w-6 h-6 rounded-lg border-2 border-gray-200 bg-gray-100 shrink-0"></div>
                        <div>
                            <span class="text-sm font-bold block leading-tight text-gray-400">${r.routine_name}</span>
                            <span class="text-[10px] text-gray-400 font-bold mt-0.5 inline-block">${goalIcon} ${repeatLabel} · 오늘은 쉬는 날</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 pl-2">
                        <span class="text-xs font-bold text-gray-300 flex items-center shrink-0"><i data-lucide="flame" class="w-4 h-4 mr-1"></i> ${r.streak_count || 0}일</span>
                        <button onclick="window.deleteRoutine('${r.id}')" class="text-gray-400 hover:text-pancake-failure p-1 shrink-0"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML += `
            <div class="flex justify-between items-center p-3 bg-white rounded-xl border ${isDone ? 'border-pancake-success bg-[#F0FDFA]' : 'border-gray-200'} shadow-sm transition hover:shadow-md">
                <div class="flex items-center gap-3 cursor-pointer flex-1" onclick="window.toggleRoutine('${r.id}')">
                    <div class="w-6 h-6 rounded-lg border-2 flex items-center justify-center ${isDone ? 'bg-pancake-success border-pancake-success text-white' : 'border-gray-300 bg-gray-50'} transition shrink-0">
                        ${isDone ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}
                    </div>
                    <div>
                        <span class="text-sm font-bold block leading-tight ${isDone ? 'text-pancake-success' : 'text-pancake-text'}">${r.routine_name}</span>
                        <span class="text-[10px] text-gray-400 font-bold mt-0.5 inline-block">${goalIcon} ${repeatLabel} · ${isDone ? '완료됨' : `완료 시 +${r.exp_reward} EXP`}</span>
                    </div>
                </div>
                <div class="flex items-center gap-3 pl-2">
                    <span class="text-xs font-bold ${isDone ? 'text-pancake-warning' : 'text-gray-400'} flex items-center shrink-0"><i data-lucide="flame" class="w-4 h-4 mr-1"></i> ${r.streak_count || 0}일</span>
                    <button onclick="window.deleteRoutine('${r.id}')" class="text-gray-400 hover:text-pancake-failure p-1 shrink-0"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        `;
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}
