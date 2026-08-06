// ================= [TAB 4] GOAL (목표관리) 전용 스크립트 =================

let localTopGoals = [];
let localQuests = [];
let localRoutines = [];
let localMilestones = [];
let localRoutineLogs = [];
let routineTrendChartInstance = null;
let questFilterGoalId = 'all';
let showCompletedQuests = false;
let editingTopGoalId = null;
let editingQuestId = null;
let editingRoutineId = null;

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
        safeCall(window.renderRoutineStats);
    }
}

// 2. 데이터 불러오기 기능
const originalInitializeData = window.initializeData || async function(){};
window.initializeData = async function() {
    await originalInitializeData(); 
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try {
            const uid = currentUser.uid;
            const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
            const cutoffStr = cutoff.toISOString().split('T')[0];
            const [gSnap, qSnap, rSnap, mSnap, lSnap] = await Promise.all([
                db.collection("users").doc(uid).collection("top_goals").orderBy("created_at").get(),
                db.collection("users").doc(uid).collection("quests").get(),
                db.collection("users").doc(uid).collection("routines").get(),
                db.collection("users").doc(uid).collection("milestones").get(),
                db.collection("users").doc(uid).collection("routine_logs").where("date", ">=", cutoffStr).get()
            ]);
            localTopGoals = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localQuests = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localRoutines = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localMilestones = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            localRoutineLogs = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
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

window.isRoutineDueOnDay = function(routine, dow) {
    if(!routine.repeat_days || !Array.isArray(routine.repeat_days) || routine.repeat_days.length === 0) return true; // 기존 루틴(매일) 하위호환
    return routine.repeat_days.includes(dow);
}

window.isRoutineDueToday = function(routine) {
    return window.isRoutineDueOnDay(routine, new Date().getDay());
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
    editingRoutineId = null;
    const nameEl = document.getElementById('routine-name');
    const expEl = document.getElementById('routine-exp');
    const parentEl = document.getElementById('routine-parent');
    if(nameEl) nameEl.value = '';
    if(expEl) expEl.value = '';
    if(parentEl && parentEl.options.length > 0) parentEl.selectedIndex = 0;
    window.setAllDays(true);
    const titleH = document.getElementById('routine-modal-title');
    const btn = document.getElementById('routine-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="sprout" class="w-5 h-5 mr-2 text-pancake-success"></i> 반복할 루틴 추가';
    if(btn) btn.textContent = '루틴 심기';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

window.openEditRoutine = function(id) {
    const r = localRoutines.find(x => x.id === id);
    if(!r) return;
    editingRoutineId = id;
    const nameEl = document.getElementById('routine-name');
    const expEl = document.getElementById('routine-exp');
    const parentEl = document.getElementById('routine-parent');
    if(nameEl) nameEl.value = r.routine_name || '';
    if(expEl) expEl.value = r.exp_reward || '';
    if(parentEl) parentEl.value = r.parent_goal_id || '';
    // 요일 셋팅
    const days = (r.repeat_days && Array.isArray(r.repeat_days) && r.repeat_days.length > 0) ? r.repeat_days : [0,1,2,3,4,5,6];
    document.querySelectorAll('#routine-repeat-days .pc-day-btn').forEach(btn => {
        const d = parseInt(btn.dataset.day);
        btn.classList.toggle('selected', days.includes(d));
    });
    const titleH = document.getElementById('routine-modal-title');
    const btn = document.getElementById('routine-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="pencil" class="w-5 h-5 mr-2 text-pancake-success"></i> 루틴 수정';
    if(btn) btn.textContent = '변경사항 저장';
    if(typeof lucide !== 'undefined') lucide.createIcons();
    if(typeof openModal !== 'undefined') openModal('add-routine-modal');
}

// ================= [최상위 목표 (Top Goals) 기능] =================

window.resetTopGoalModal = function() {
    editingTopGoalId = null;
    const titleEl = document.getElementById('top-goal-title');
    const iconEl = document.getElementById('top-goal-icon');
    const colorEl = document.getElementById('top-goal-color');
    const expEl = document.getElementById('top-goal-max-exp');
    const deadlineEl = document.getElementById('top-goal-deadline');
    if(titleEl) titleEl.value = '';
    if(iconEl) iconEl.value = '';
    if(colorEl) colorEl.value = 'primary';
    if(expEl) expEl.value = '';
    if(deadlineEl) deadlineEl.value = '';
    const titleH = document.getElementById('top-goal-modal-title');
    const btn = document.getElementById('top-goal-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="target" class="w-5 h-5 mr-2 text-pancake-primary"></i> 새 최상위 목표 생성';
    if(btn) btn.textContent = '목표 생성하기';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

window.openEditTopGoal = function(id) {
    const g = localTopGoals.find(x => x.id === id);
    if(!g) return;
    editingTopGoalId = id;
    const titleEl = document.getElementById('top-goal-title');
    const iconEl = document.getElementById('top-goal-icon');
    const colorEl = document.getElementById('top-goal-color');
    const expEl = document.getElementById('top-goal-max-exp');
    const deadlineEl = document.getElementById('top-goal-deadline');
    if(titleEl) titleEl.value = g.title || '';
    if(iconEl) iconEl.value = g.icon || '';
    if(colorEl) colorEl.value = g.color || 'primary';
    if(expEl) expEl.value = g.max_exp || '';
    if(deadlineEl) deadlineEl.value = g.deadline || '';
    const titleH = document.getElementById('top-goal-modal-title');
    const btn = document.getElementById('top-goal-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="pencil" class="w-5 h-5 mr-2 text-pancake-primary"></i> 목표 수정';
    if(btn) btn.textContent = '변경사항 저장';
    if(typeof lucide !== 'undefined') lucide.createIcons();
    if(typeof openModal !== 'undefined') openModal('add-top-goal-modal');
}

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

        const isEditing = !!editingTopGoalId;
        const editId = editingTopGoalId;

        // 모달부터 무조건 닫기
        if(typeof closeModal !== 'undefined') closeModal('add-top-goal-modal');
        window.resetTopGoalModal();

        if(isEditing) {
            const existing = localTopGoals.find(g => g.id === editId);
            if(!existing) { alert("수정할 목표를 찾지 못했습니다."); return; }
            const updates = { title, icon, color, max_exp: maxExp, deadline: deadline || '' };
            Object.assign(existing, updates);
            if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
                try { await db.collection("users").doc(currentUser.uid).collection("top_goals").doc(editId).update(updates); }
                catch(fbErr) { console.warn("DB 권한 오류:", fbErr); }
            }
            window.renderTopGoals(); window.updateDropdowns(); window.renderQuests(); window.renderRoutines(); window.renderTodayChecklist();
            // 경험치가 남아있는 상태에서 max_exp가 바뀌면 마일스톤/레벨이 재계산되므로 마일스톤도 체크
            window.checkMilestones(editId, existing.current_exp);
            if(typeof showToast !== 'undefined') showToast("목표가 수정되었습니다.");
            return;
        }

        const goalData = { title, icon, color, max_exp: maxExp, current_exp: 0, created_at: new Date().toISOString(), deadline: deadline || '' };
        let newId = 'g_' + Date.now();

        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
            try {
                const docRef = await db.collection("users").doc(currentUser.uid).collection("top_goals").add(goalData);
                newId = docRef.id;
            } catch(fbErr) {
                console.warn("DB 권한 오류 - 화면에만 먼저 표시합니다.", fbErr);
            }
        }
        
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

        const goalMilestones = localMilestones.filter(m => m.parent_goal_id === goal.id);
        const expMilestones = goalMilestones.filter(m => (m.type || 'exp') === 'exp').sort((a,b) => a.target_exp - b.target_exp);
        const manualMilestones = goalMilestones.filter(m => (m.type || 'exp') === 'manual').sort((a,b) => {
            const ao = (typeof a.order === 'number') ? a.order : Number.MAX_SAFE_INTEGER;
            const bo = (typeof b.order === 'number') ? b.order : Number.MAX_SAFE_INTEGER;
            if (ao !== bo) return ao - bo;
            return (a.created_at||'').localeCompare(b.created_at||'');
        });

        // 경험치 자동형: 진행바 위 깃발 마커
        const flagsHtml = expMilestones.map(m => {
            const pct = Math.min(100, Math.max(0, (m.target_exp / goal.max_exp) * 100));
            return `<div class="milestone-flag" style="left:${pct}%;" title="${m.title} (${m.target_exp} EXP)">${m.achieved ? '🚩' : '🏳️'}</div>`;
        }).join('');

        // 경험치 자동형: 칩 목록 (읽기 전용 상태 표시)
        const expChipsHtml = expMilestones.length > 0 ? `<div class="flex flex-wrap gap-1.5 mt-2">${expMilestones.map(m => `
            <span class="milestone-chip ${m.achieved ? 'achieved' : ''}">${m.achieved ? '✅' : '⬜'} ${m.title}<button onclick="window.deleteMilestone('${m.id}')" class="ml-1 text-gray-400 hover:text-pancake-failure">×</button></span>
        `).join('')}</div>` : '';

        // 직접 체크형: 수직 타임라인 (드래그로 순서 조정 가능)
        const manualTimelineHtml = manualMilestones.length > 0
            ? window.renderMilestoneTimeline(manualMilestones, goal.id, false)
            : '';

        const milestoneBodyHtml = (manualMilestones.length === 0 && expMilestones.length === 0)
            ? '<span class="text-[10px] text-gray-300 font-bold">설정된 마일스톤이 없어요</span>'
            : manualTimelineHtml + expChipsHtml;

        const hasManyManual = manualMilestones.length >= 2;
        const expandBtnHtml = manualMilestones.length > 0
            ? `<button onclick="window.openMilestoneTimelineModal('${goal.id}')" class="text-[10px] font-bold text-gray-500 hover:text-pancake-primary flex items-center gap-0.5" title="타임라인 확대"><i data-lucide="maximize-2" class="w-3 h-3"></i></button>`
            : '';

        container.innerHTML += `
            <div class="pc-card border-t-4 border-pancake-${goal.color} hover:-translate-y-1 transition duration-300 relative group">
                <div class="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onclick="window.openEditTopGoal('${goal.id}')" class="text-gray-300 hover:text-pancake-primary" title="목표 수정"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    <button onclick="window.deleteTopGoal('${goal.id}')" class="text-gray-300 hover:text-pancake-failure" title="목표 삭제"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
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
                        <div class="flex items-center gap-2">
                            ${expandBtnHtml}
                            <button onclick="window.openAddMilestoneModal('${goal.id}')" class="text-[10px] font-bold text-pancake-primary hover:underline">+ 추가</button>
                        </div>
                    </div>
                    ${milestoneBodyHtml}
                </div>
            </div>
        `;
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [마일스톤 (Milestones) 기능] =================

window.setMilestoneType = function(type) {
    document.querySelectorAll('#milestone-type-group .pc-day-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.type === type);
    });
    const expField = document.getElementById('milestone-exp-field');
    const desc = document.getElementById('milestone-type-desc');
    const expInput = document.getElementById('milestone-target-exp');
    if(type === 'exp') {
        if(expField) expField.classList.remove('hidden');
        if(expInput) expInput.required = true;
        if(desc) desc.textContent = '루틴/퀘스트로 쌓이는 경험치가 이 수치에 도달하면 자동으로 달성 처리돼요. (예: 저축 목표처럼 경험치=실제 진척인 경우)';
    } else {
        if(expField) expField.classList.add('hidden');
        if(expInput) { expInput.required = false; expInput.value = ''; }
        if(desc) desc.textContent = '시험 합격, 자격증 취득처럼 경험치와 무관하게 실제로 이뤘을 때 직접 체크하는 방식이에요. (예: N3 합격, N2 합격)';
    }
}

window.openAddMilestoneModal = function(goalId) {
    const goal = localTopGoals.find(g => g.id === goalId);
    if(!goal) return;
    const parentIdEl = document.getElementById('milestone-parent-id');
    const nameLabel = document.getElementById('milestone-parent-name');
    if(parentIdEl) parentIdEl.value = goalId;
    if(nameLabel) nameLabel.textContent = `${goal.icon} ${goal.title} 목표에 추가됩니다`;
    window.setMilestoneType('manual');
    if(typeof openModal !== 'undefined') openModal('add-milestone-modal');
}

window.addMilestone = async function() {
    try {
        const goalId = document.getElementById('milestone-parent-id').value;
        const titleEl = document.getElementById('milestone-title');
        const expEl = document.getElementById('milestone-target-exp');
        const typeBtn = document.querySelector('#milestone-type-group .pc-day-btn.selected');
        const type = typeBtn ? typeBtn.dataset.type : 'manual';
        const title = titleEl.value.trim();

        const parentGoal = localTopGoals.find(g => g.id === goalId);
        if(!parentGoal) { alert("목표를 찾을 수 없습니다."); return; }
        if(!title) { alert("마일스톤 이름을 입력해주세요."); return; }

        let targetExp = null;
        if(type === 'exp') {
            targetExp = parseInt(expEl.value);
            if(isNaN(targetExp) || targetExp <= 0) { alert("목표 경험치를 올바르게 입력해주세요."); return; }
            if(targetExp > parentGoal.max_exp) { alert(`목표 경험치는 이 목표의 최대 경험치(${parentGoal.max_exp})를 넘을 수 없습니다.`); return; }
        }

        titleEl.value = ''; expEl.value = '';
        window.setMilestoneType('manual');
        if(typeof closeModal !== 'undefined') closeModal('add-milestone-modal');

        const achievedNow = type === 'exp' ? (parentGoal.current_exp >= targetExp) : false;
        // manual 마일스톤은 order 자동 부여 (같은 목표의 기존 개수 = 새 항목 순서)
        const currentManualCount = localMilestones.filter(x => x.parent_goal_id === goalId && (x.type || 'exp') === 'manual').length;
        const msData = { parent_goal_id: goalId, title, type, target_exp: targetExp, achieved: achievedNow, achieved_at: achievedNow ? new Date().toISOString() : '', created_at: new Date().toISOString(), order: type === 'manual' ? currentManualCount : null };
        let newId = 'm_' + Date.now();

        if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
            try {
                const docRef = await db.collection("users").doc(currentUser.uid).collection("milestones").add(msData);
                newId = docRef.id;
            } catch(e) { console.warn(e); }
        }

        localMilestones.push({ id: newId, ...msData });
        window.renderTopGoals();
        // 확대 모달이 열려있으면 그것도 갱신
        const timelineModal = document.getElementById('milestone-timeline-modal');
        if(timelineModal && !timelineModal.classList.contains('hidden')) {
            window.refreshMilestoneTimelineModal();
        }
        if(typeof showToast !== 'undefined') showToast("마일스톤이 추가되었습니다!");
    } catch(e) { alert(e.message); }
}

window.toggleMilestoneManual = async function(id) {
    const m = localMilestones.find(x => x.id === id);
    if(!m) return;
    const nowAchieved = !m.achieved;
    m.achieved = nowAchieved;
    m.achieved_at = nowAchieved ? new Date().toISOString() : '';

    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try { await db.collection("users").doc(currentUser.uid).collection("milestones").doc(id).update({ achieved: m.achieved, achieved_at: m.achieved_at }); } catch(e){ console.warn(e); }
    }

    window.renderTopGoals();
    window.refreshMilestoneTimelineModal();
    if(nowAchieved && typeof window.showMilestoneCelebration === 'function') window.showMilestoneCelebration(m.title);
}

window.deleteMilestone = async function(id) {
    if(!confirm("이 마일스톤을 삭제하시겠습니까?")) return;
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try { await db.collection("users").doc(currentUser.uid).collection("milestones").doc(id).delete(); } catch(e){}
    }
    localMilestones = localMilestones.filter(m => m.id !== id);
    window.renderTopGoals();
    window.refreshMilestoneTimelineModal();
}

window.checkMilestones = async function(goalId, currentExp) {
    const related = localMilestones.filter(m => m.parent_goal_id === goalId && (m.type || 'exp') === 'exp');
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
        if (q.is_completed) return; // 완료된 퀘스트는 오늘 체크리스트에서 제외
        // 마감이 오늘까지거나 이미 지난 퀘스트만 오늘 체크리스트에 표시
        const dInfo = window.getQuestDeadlineInfo ? window.getQuestDeadlineInfo(q.deadline) : { today: false, overdue: false };
        if (!dInfo.today && !dInfo.overdue) return;
        const parentGoal = localTopGoals.find(g => g.id === q.parent_goal_id);
        items.push({
            type: 'quest', id: q.id,
            done: false,
            rawDone: false,
            label: q.task_name,
            sub: parentGoal ? `${parentGoal.icon} ${parentGoal.title}` : '연결된 목표 없음',
            meta: dInfo.overdue ? `⚠️ ${dInfo.label}` : '오늘 마감'
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

    container.innerHTML = items.map(item => {
        const deleteCall = item.type === 'routine' ? `window.deleteRoutine('${item.id}')` : `window.deleteQuest('${item.id}')`;
        return `
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
            <div class="flex items-center gap-2 pl-2 shrink-0">
                <span class="text-[10px] font-bold text-gray-400">${item.meta}</span>
                <button onclick="${deleteCall}" class="text-gray-400 hover:text-pancake-failure p-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>
    `;
    }).join('');
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [퀘스트 (Quests) 기능] =================

window.setQuestPriority = function(priority) {
    document.querySelectorAll('#quest-priority-group .pc-day-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.priority === priority);
    });
}

window.resetQuestModal = function() {
    editingQuestId = null;
    const nameEl = document.getElementById('quest-name');
    const deadlineEl = document.getElementById('quest-deadline');
    const parentEl = document.getElementById('quest-parent');
    if(nameEl) nameEl.value = '';
    if(deadlineEl) deadlineEl.value = '';
    if(parentEl && parentEl.options.length > 0) parentEl.selectedIndex = 0;
    window.setQuestPriority('medium');
    const titleH = document.getElementById('quest-modal-title');
    const btn = document.getElementById('quest-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="plus-circle" class="w-5 h-5 mr-2 text-pancake-secondary"></i> 세부 퀘스트 추가';
    if(btn) btn.textContent = '퀘스트 등록';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

window.openEditQuest = function(id) {
    const q = localQuests.find(x => x.id === id);
    if(!q) return;
    editingQuestId = id;
    const nameEl = document.getElementById('quest-name');
    const deadlineEl = document.getElementById('quest-deadline');
    const parentEl = document.getElementById('quest-parent');
    if(nameEl) nameEl.value = q.task_name || '';
    if(deadlineEl) deadlineEl.value = q.deadline || '';
    if(parentEl) parentEl.value = q.parent_goal_id || '';
    window.setQuestPriority(q.priority || 'medium');
    const titleH = document.getElementById('quest-modal-title');
    const btn = document.getElementById('quest-submit-btn');
    if(titleH) titleH.innerHTML = '<i data-lucide="pencil" class="w-5 h-5 mr-2 text-pancake-secondary"></i> 퀘스트 수정';
    if(btn) btn.textContent = '변경사항 저장';
    if(typeof lucide !== 'undefined') lucide.createIcons();
    if(typeof openModal !== 'undefined') openModal('add-quest-modal');
}

window.setQuestFilter = function(goalId) {
    questFilterGoalId = goalId;
    window.renderQuests();
}

window.toggleShowCompletedQuests = function() {
    showCompletedQuests = !showCompletedQuests;
    const label = document.getElementById('quest-show-completed-label');
    if(label) label.textContent = showCompletedQuests ? '완료된 퀘스트 숨기기' : '완료된 퀘스트 보기';
    window.renderQuests();
}

window.addQuest = async function() {
    try {
        const parentId = document.getElementById('quest-parent').value;
        const taskNameEl = document.getElementById('quest-name');
        const deadlineEl = document.getElementById('quest-deadline');
        const priorityBtn = document.querySelector('#quest-priority-group .pc-day-btn.selected');
        const priority = priorityBtn ? priorityBtn.dataset.priority : 'medium';
        const taskName = taskNameEl.value.trim();
        const deadline = deadlineEl ? deadlineEl.value : '';
        
        if(!parentId || !taskName) return alert("목표를 선택하고 내용을 입력하세요.");

        const isEditing = !!editingQuestId;
        const editId = editingQuestId;

        // 무조건 창부터 닫기
        if(typeof closeModal !== 'undefined') closeModal('add-quest-modal');
        window.resetQuestModal();

        if(isEditing) {
            const existing = localQuests.find(q => q.id === editId);
            if(!existing) { alert("수정할 퀘스트를 찾지 못했습니다."); return; }
            const updates = { parent_goal_id: parentId, task_name: taskName, priority, deadline: deadline || '' };
            Object.assign(existing, updates);
            if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
                try { await db.collection("users").doc(currentUser.uid).collection("quests").doc(editId).update(updates); } catch(e){ console.warn(e); }
            }
            window.renderQuests();
            window.renderTodayChecklist();
            if(typeof showToast !== 'undefined') showToast("퀘스트가 수정되었습니다.");
            return;
        }

        const questData = { parent_goal_id: parentId, task_name: taskName, is_completed: false, created_at: new Date().toISOString(), priority, deadline: deadline || '', completed_at: '' };
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
    const quest = localQuests.find(q => q.id === id);
    if(quest) {
        quest.is_completed = !currentStatus;
        quest.completed_at = !currentStatus ? new Date().toISOString() : '';
    }
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        try { await db.collection("users").doc(currentUser.uid).collection("quests").doc(id).update({ is_completed: !currentStatus, completed_at: !currentStatus ? new Date().toISOString() : '' }); } catch(e){}
    }
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

window.getQuestDeadlineInfo = function(deadlineStr) {
    if(!deadlineStr) return { label: '', className: '', sortKey: Number.MAX_SAFE_INTEGER, overdue: false, today: false };
    const today = new Date(); today.setHours(0,0,0,0);
    const deadline = new Date(deadlineStr + 'T00:00:00');
    if(isNaN(deadline.getTime())) return { label: '', className: '', sortKey: Number.MAX_SAFE_INTEGER, overdue: false, today: false };
    const diffDays = Math.round((deadline - today) / 86400000);
    if(diffDays < 0) return { label: `D+${Math.abs(diffDays)} 기한초과`, className: 'overdue', sortKey: diffDays, overdue: true, today: false };
    if(diffDays === 0) return { label: '오늘까지', className: 'today', sortKey: 0, overdue: false, today: true };
    return { label: `D-${diffDays}`, className: '', sortKey: diffDays, overdue: false, today: false };
}

window.renderQuests = function() {
    const container = document.getElementById('quest-board-container');
    if(!container) return;
    container.innerHTML = '';

    // 1) 필터 바 렌더
    const filterBar = document.getElementById('quest-filter-bar');
    if(filterBar) {
        let filterHtml = `<button class="quest-filter-chip ${questFilterGoalId==='all'?'selected':''}" onclick="window.setQuestFilter('all')">전체</button>`;
        localTopGoals.forEach(g => {
            const cnt = localQuests.filter(q => q.parent_goal_id === g.id && !q.is_completed).length;
            filterHtml += `<button class="quest-filter-chip ${questFilterGoalId===g.id?'selected':''}" onclick="window.setQuestFilter('${g.id}')">${g.icon} ${g.title}${cnt>0?` <span class="text-[9px] opacity-70">(${cnt})</span>`:''}</button>`;
        });
        filterBar.innerHTML = filterHtml;
    }

    // 2) 필터 적용 및 통계 카운트
    const filteredQuests = questFilterGoalId === 'all'
        ? localQuests
        : localQuests.filter(q => q.parent_goal_id === questFilterGoalId);
    const activeCount = filteredQuests.filter(q => !q.is_completed).length;
    const completedCount = filteredQuests.filter(q => q.is_completed).length;
    const countEl = document.getElementById('quest-active-count');
    if(countEl) countEl.textContent = `진행중 ${activeCount} · 완료 ${completedCount}`;

    if (filteredQuests.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-6 font-bold">등록된 퀘스트가 없습니다.</div>';
        if(typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    const priorityWeight = { high: 0, medium: 1, low: 2 };

    // 3) 목표별 그룹 렌더 (진행중만 우선순위/마감 정렬)
    const goalsToRender = questFilterGoalId === 'all' ? localTopGoals : localTopGoals.filter(g => g.id === questFilterGoalId);

    goalsToRender.forEach(goal => {
        const quests = filteredQuests.filter(q => q.parent_goal_id === goal.id && !q.is_completed);
        if(quests.length === 0) return;

        // 정렬: 기한초과 → 오늘 → 임박순, 같은 기한 그룹 내에서는 우선순위(높음>보통>낮음), 마지막에 마감 없는 것
        quests.sort((a, b) => {
            const ai = window.getQuestDeadlineInfo(a.deadline);
            const bi = window.getQuestDeadlineInfo(b.deadline);
            if (ai.sortKey !== bi.sortKey) return ai.sortKey - bi.sortKey;
            const pw = (priorityWeight[a.priority || 'medium']) - (priorityWeight[b.priority || 'medium']);
            if (pw !== 0) return pw;
            return (a.created_at || '').localeCompare(b.created_at || '');
        });

        let html = `<div class="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <h4 class="text-xs font-bold text-pancake-text mb-2 flex items-center gap-1">
                <span>${goal.icon} ${goal.title}</span>
                <span class="text-[10px] font-bold text-gray-400 ml-1">${quests.length}건</span>
            </h4>`;
        quests.forEach(q => {
            const dInfo = window.getQuestDeadlineInfo(q.deadline);
            const priority = q.priority || 'medium';
            const pLabel = priority === 'high' ? '🔥 높음' : priority === 'low' ? '💧 낮음' : '🟡 보통';
            const edgeClass = dInfo.overdue ? 'quest-item-overdue' : (dInfo.today ? 'quest-item-today' : '');
            html += `
                <div class="flex justify-between items-center p-2 mb-2 bg-white rounded-lg border border-gray-200 shadow-sm transition hover:border-pancake-primary/50 ${edgeClass}">
                    <div class="flex items-start gap-2 cursor-pointer flex-1 min-w-0" onclick="window.toggleQuest('${q.id}', false)">
                        <div class="w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 border-gray-300"></div>
                        <div class="min-w-0 flex-1">
                            <div class="text-sm font-bold text-pancake-text leading-tight break-words">${q.task_name}</div>
                            <div class="flex flex-wrap gap-1 mt-1 items-center">
                                <span class="quest-priority-badge quest-priority-${priority}">${pLabel}</span>
                                ${dInfo.label ? `<span class="quest-deadline-badge ${dInfo.className}"><i data-lucide="calendar" class="w-2.5 h-2.5 inline mr-0.5"></i>${dInfo.label}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-0.5 shrink-0">
                        <button onclick="event.stopPropagation(); window.openEditQuest('${q.id}')" class="text-gray-400 hover:text-pancake-primary p-1" title="수정"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="event.stopPropagation(); window.deleteQuest('${q.id}')" class="text-gray-400 hover:text-pancake-failure p-1" title="삭제"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML += html;
    });

    if(activeCount === 0) {
        container.innerHTML += '<div class="text-center text-sm text-gray-400 py-6 font-bold">🎉 진행중인 퀘스트가 없어요. 새 퀘스트를 추가하거나 완료된 퀘스트를 확인해보세요.</div>';
    }

    // 4) 완료된 퀘스트 아카이브 (토글 시)
    if(showCompletedQuests) {
        const doneQuests = filteredQuests.filter(q => q.is_completed).sort((a,b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
        if(doneQuests.length > 0) {
            let archHtml = `<div class="mt-4 pt-4 border-t-2 border-dashed border-gray-200">
                <div class="text-xs font-bold text-gray-500 mb-2 flex items-center"><i data-lucide="archive" class="w-3.5 h-3.5 mr-1"></i> 완료된 퀘스트 (${doneQuests.length})</div>`;
            doneQuests.forEach(q => {
                const parentGoal = localTopGoals.find(g => g.id === q.parent_goal_id);
                const goalLabel = parentGoal ? `${parentGoal.icon} ${parentGoal.title}` : '';
                const completedDate = q.completed_at ? q.completed_at.split('T')[0] : '';
                archHtml += `
                    <div class="flex justify-between items-center p-2 mb-1.5 bg-gray-50 rounded-lg border border-gray-100">
                        <div class="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onclick="window.toggleQuest('${q.id}', true)" title="클릭하면 진행중으로 되돌립니다">
                            <div class="w-4 h-4 rounded-full bg-pancake-success flex items-center justify-center shrink-0"><i data-lucide="check" class="w-2.5 h-2.5 text-white"></i></div>
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-gray-400 line-through truncate">${q.task_name}</div>
                                <div class="text-[10px] text-gray-400 font-bold truncate">${goalLabel}${completedDate ? ` · ${completedDate} 완료` : ''}</div>
                            </div>
                        </div>
                        <button onclick="window.deleteQuest('${q.id}')" class="text-gray-300 hover:text-pancake-failure p-1 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                `;
            });
            archHtml += `</div>`;
            container.innerHTML += archHtml;
        } else {
            container.innerHTML += '<div class="mt-4 pt-4 border-t-2 border-dashed border-gray-200 text-center text-xs text-gray-400 font-bold py-3">완료된 퀘스트가 없어요.</div>';
        }
    }

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

        const isEditing = !!editingRoutineId;
        const editId = editingRoutineId;

        if(typeof closeModal !== 'undefined') closeModal('add-routine-modal');
        window.resetRoutineModal();

        if(isEditing) {
            const existing = localRoutines.find(r => r.id === editId);
            if(!existing) { alert("수정할 루틴을 찾지 못했습니다."); return; }
            const updates = { parent_goal_id: parentId, routine_name: name, exp_reward: expReward, repeat_days: repeatDays };
            Object.assign(existing, updates);
            if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
                try { await db.collection("users").doc(currentUser.uid).collection("routines").doc(editId).update(updates); } catch(e){ console.warn(e); }
            }
            window.renderRoutines();
            window.renderTodayChecklist();
            window.renderRoutineStats();
            if(typeof showToast !== 'undefined') showToast("루틴이 수정되었습니다.");
            return;
        }

        const routineData = { parent_goal_id: parentId, routine_name: name, exp_reward: expReward, streak_count: 0, last_completed_date: '', repeat_days: repeatDays, created_at: new Date().toISOString() };
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
        window.renderRoutineStats();
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

    // 레벨업 감지 — 렌더링 로직과 동일한 공식으로 이전/이후 레벨 계산
    const oldExp = parentGoal.current_exp;
    const computeLevel = (exp) => {
        let lv = Math.floor((exp / parentGoal.max_exp) * 99) + 1;
        if (lv > 100) lv = 100;
        if (lv < 1) lv = 1;
        return lv;
    };
    const oldLevel = computeLevel(oldExp);
    const newLevel = computeLevel(newGoalExp);

    routine.streak_count = newStreak;
    routine.last_completed_date = newDate;
    parentGoal.current_exp = newGoalExp;

    // 일별 완료 기록(로그) 갱신 — 성공률 통계/그래프의 원천 데이터
    const logId = `${id}_${todayStr}`;
    if (isDoneToday) {
        // 완료 취소: 오늘자 로그 제거
        localRoutineLogs = localRoutineLogs.filter(l => !(l.routine_id === id && l.date === todayStr));
    } else {
        // 완료 처리: 오늘자 로그 기록
        localRoutineLogs = localRoutineLogs.filter(l => !(l.routine_id === id && l.date === todayStr));
        localRoutineLogs.push({ id: logId, routine_id: id, parent_goal_id: routine.parent_goal_id, date: todayStr, completed: true, exp_reward: routine.exp_reward || 0 });
    }

    window.renderRoutines();
    window.renderTopGoals();
    window.renderTodayChecklist();
    window.renderRoutineStats();

    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) { 
        try {
            await db.collection("users").doc(currentUser.uid).collection("routines").doc(id).update({ streak_count: newStreak, last_completed_date: newDate }); 
            await db.collection("users").doc(currentUser.uid).collection("top_goals").doc(parentGoal.id).update({ current_exp: newGoalExp });
            if (isDoneToday) {
                await db.collection("users").doc(currentUser.uid).collection("routine_logs").doc(logId).delete();
            } else {
                await db.collection("users").doc(currentUser.uid).collection("routine_logs").doc(logId).set({ routine_id: id, parent_goal_id: routine.parent_goal_id, date: todayStr, completed: true, exp_reward: routine.exp_reward || 0 });
            }
        } catch(e){ console.warn(e); }
    }

    if(!isDoneToday && typeof showToast !== 'undefined') showToast(`🎉 루틴 달성! (+${routine.exp_reward} EXP 획득)`);

    // 레벨업 축하 (마일스톤 축하와 겹치지 않게 살짝 지연 후 순차 재생)
    if (newLevel > oldLevel && typeof window.showLevelUpCelebration === 'function') {
        setTimeout(() => window.showLevelUpCelebration(parentGoal, oldLevel, newLevel), 150);
    }

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
    window.renderRoutineStats();
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
                    <div class="flex items-center gap-2 pl-2">
                        <span class="text-xs font-bold text-gray-300 flex items-center shrink-0"><i data-lucide="flame" class="w-4 h-4 mr-1"></i> ${r.streak_count || 0}일</span>
                        <button onclick="window.openEditRoutine('${r.id}')" class="text-gray-400 hover:text-pancake-primary p-1 shrink-0" title="수정"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.deleteRoutine('${r.id}')" class="text-gray-400 hover:text-pancake-failure p-1 shrink-0" title="삭제"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
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
                <div class="flex items-center gap-2 pl-2">
                    <span class="text-xs font-bold ${isDone ? 'text-pancake-warning' : 'text-gray-400'} flex items-center shrink-0"><i data-lucide="flame" class="w-4 h-4 mr-1"></i> ${r.streak_count || 0}일</span>
                    <button onclick="window.openEditRoutine('${r.id}')" class="text-gray-400 hover:text-pancake-primary p-1 shrink-0" title="수정"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                    <button onclick="window.deleteRoutine('${r.id}')" class="text-gray-400 hover:text-pancake-failure p-1 shrink-0" title="삭제"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        `;
    });
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [루틴 성공률 통계 & 추이 그래프] =================

window.getDayStats = function(dateStr) {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const dueRoutines = localRoutines.filter(r => {
        if (r.created_at) {
            const createdDateStr = r.created_at.split('T')[0];
            if (dateStr < createdDateStr) return false; // 아직 생성되지 않았던 날짜는 제외
        }
        return window.isRoutineDueOnDay(r, dow);
    });
    const total = dueRoutines.length;
    if (total === 0) return { total: 0, done: 0, rate: null };
    const done = dueRoutines.filter(r =>
        localRoutineLogs.some(l => l.routine_id === r.id && l.date === dateStr && l.completed)
    ).length;
    return { total, done, rate: Math.round((done / total) * 100) };
}

window.getMondayStr = function(dateObj) {
    const d = new Date(dateObj);
    d.setHours(0,0,0,0);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // 월요일 시작 기준 보정
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
}

window.renderRoutineStats = function() {
    const yEl = document.getElementById('stat-yesterday-rate');
    const tEl = document.getElementById('stat-today-rate');
    const wEl = document.getElementById('stat-week-rate');
    const canvas = document.getElementById('routine-trend-chart');
    const emptyEl = document.getElementById('routine-trend-empty');
    if (!canvas) return;

    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yStats = window.getDayStats(yesterdayStr);
    const tStats = window.getDayStats(todayStr);
    if (yEl) yEl.textContent = yStats.rate === null ? '-' : `${yStats.rate}%`;
    if (tEl) tEl.textContent = tStats.rate === null ? '-' : `${tStats.rate}%`;

    // 이번주 (월요일 ~ 오늘) 합산 성공률
    const mondayStr = window.getMondayStr(today);
    let weekDue = 0, weekDone = 0;
    for (let d = new Date(mondayStr + 'T00:00:00'); d <= today; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split('T')[0];
        const s = window.getDayStats(dStr);
        weekDue += s.total; weekDone += s.done;
    }
    if (wEl) wEl.textContent = weekDue === 0 ? '-' : `${Math.round((weekDone / weekDue) * 100)}%`;

    // 최근 14일 추이 (예정된 루틴이 하루라도 있었던 날짜만 표시)
    const trendLabels = [];
    const trendData = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const s = window.getDayStats(dStr);
        if (s.total > 0) {
            trendLabels.push(`${d.getMonth() + 1}/${d.getDate()}`);
            trendData.push(s.rate);
        }
    }

    if (routineTrendChartInstance) { routineTrendChartInstance.destroy(); routineTrendChartInstance = null; }

    if (trendData.length === 0) {
        canvas.classList.add('hidden');
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }
    canvas.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');

    if (typeof Chart === 'undefined') return;
    routineTrendChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [{
                label: '루틴 성공률(%)',
                data: trendData,
                borderColor: '#1FC7D4',
                backgroundColor: 'rgba(31, 199, 212, 0.12)',
                borderWidth: 2.5,
                tension: 0.35,
                fill: true,
                pointRadius: 3,
                pointBackgroundColor: '#1FC7D4',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `성공률 ${ctx.parsed.y}%` } }
            },
            scales: {
                y: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 10 } }, grid: { color: '#F0FDFA' } },
                x: { ticks: { font: { size: 10 } }, grid: { display: false } }
            }
        }
    });
}

// ================= [마일스톤 가로 타임라인(수직선) & 드래그 재정렬] =================

let draggedMilestoneId = null;
let currentTimelineGoalId = null;

window.renderMilestoneTimeline = function(manualMilestones, goalId, isExpanded) {
    if (!manualMilestones || manualMilestones.length === 0) return '';

    const items = manualMilestones.map((m, idx) => {
        const orderBadge = isExpanded ? `<div class="milestone-horder">${idx + 1}</div>` : '';
        const delBtn = isExpanded
            ? `<button onclick="event.stopPropagation(); window.deleteMilestone('${m.id}')" class="milestone-hdel" title="삭제"><i data-lucide="x" class="w-3 h-3"></i></button>`
            : '';
        return `
            <div class="milestone-hitem" draggable="true" data-milestone-id="${m.id}" data-goal-id="${goalId}"
                 ondragstart="window.onMilestoneDragStart(event, '${m.id}', '${goalId}')"
                 ondragend="window.onMilestoneDragEnd(event)"
                 ondragover="window.onMilestoneDragOver(event, '${m.id}', '${goalId}')"
                 ondragleave="window.onMilestoneDragLeave(event)"
                 ondrop="window.onMilestoneDrop(event, '${m.id}', '${goalId}')"
                 onclick="window.toggleMilestoneManual('${m.id}')"
                 title="${m.title.replace(/"/g, '&quot;')}">
                <div class="milestone-hdot ${m.achieved ? 'achieved' : ''}">
                    ${m.achieved ? '<i data-lucide="check" class="w-2.5 h-2.5 check-icon"></i>' : ''}
                </div>
                <div class="milestone-hlabel ${m.achieved ? 'achieved' : ''}">${m.title}</div>
                ${orderBadge}
                ${delBtn}
            </div>
        `;
    }).join('');

    return `<div class="milestone-hline-scroll"><div class="milestone-hline${isExpanded ? ' milestone-hline-expanded' : ''}">${items}</div></div>`;
}

window.onMilestoneDragStart = function(e, milestoneId, goalId) {
    draggedMilestoneId = milestoneId;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', milestoneId); } catch(_) {}
}

window.onMilestoneDragEnd = function(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.milestone-hitem').forEach(el => {
        el.classList.remove('drag-over-left', 'drag-over-right');
    });
    draggedMilestoneId = null;
}

window.onMilestoneDragOver = function(e, targetId, goalId) {
    if (!draggedMilestoneId || draggedMilestoneId === targetId) return;
    const dragged = localMilestones.find(m => m.id === draggedMilestoneId);
    const target = localMilestones.find(m => m.id === targetId);
    if (!dragged || !target || dragged.parent_goal_id !== target.parent_goal_id) return; // 다른 목표로는 이동 불가
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    e.currentTarget.classList.remove('drag-over-left', 'drag-over-right');
    if (e.clientX < midX) e.currentTarget.classList.add('drag-over-left');
    else e.currentTarget.classList.add('drag-over-right');
}

window.onMilestoneDragLeave = function(e) {
    e.currentTarget.classList.remove('drag-over-left', 'drag-over-right');
}

window.onMilestoneDrop = async function(e, targetId, goalId) {
    e.preventDefault();
    e.stopPropagation();
    const wasDraggedId = draggedMilestoneId;
    e.currentTarget.classList.remove('drag-over-left', 'drag-over-right');
    if (!wasDraggedId || wasDraggedId === targetId) { draggedMilestoneId = null; return; }

    const dragged = localMilestones.find(m => m.id === wasDraggedId);
    const target = localMilestones.find(m => m.id === targetId);
    if (!dragged || !target || dragged.parent_goal_id !== target.parent_goal_id) { draggedMilestoneId = null; return; }

    const rect = e.currentTarget.getBoundingClientRect();
    const dropBefore = e.clientX < rect.left + rect.width / 2;

    // 같은 목표 내 manual 마일스톤을 order 기준으로 정렬
    const siblings = localMilestones
        .filter(m => m.parent_goal_id === goalId && (m.type || 'exp') === 'manual')
        .sort((a,b) => {
            const ao = (typeof a.order === 'number') ? a.order : Number.MAX_SAFE_INTEGER;
            const bo = (typeof b.order === 'number') ? b.order : Number.MAX_SAFE_INTEGER;
            if (ao !== bo) return ao - bo;
            return (a.created_at||'').localeCompare(b.created_at||'');
        });

    const oldIdx = siblings.findIndex(m => m.id === wasDraggedId);
    if (oldIdx > -1) siblings.splice(oldIdx, 1);
    let targetIdx = siblings.findIndex(m => m.id === targetId);
    if (targetIdx < 0) targetIdx = siblings.length;
    const insertIdx = dropBefore ? targetIdx : targetIdx + 1;
    siblings.splice(insertIdx, 0, dragged);

    // order 재부여
    siblings.forEach((m, i) => { m.order = i; });

    draggedMilestoneId = null;
    window.renderTopGoals();
    window.refreshMilestoneTimelineModal();

    // Firestore 저장 (배치)
    if(typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
        try {
            const batch = db.batch();
            siblings.forEach(m => {
                const ref = db.collection("users").doc(currentUser.uid).collection("milestones").doc(m.id);
                batch.update(ref, { order: m.order });
            });
            await batch.commit();
        } catch(err) { console.warn("마일스톤 순서 저장 실패:", err); }
    }

    if(typeof showToast !== 'undefined') showToast("순서가 변경되었습니다.");
}

window.openMilestoneTimelineModal = function(goalId) {
    currentTimelineGoalId = goalId;
    const goal = localTopGoals.find(g => g.id === goalId);
    if(!goal) return;
    const nameEl = document.getElementById('milestone-timeline-goal-name');
    if(nameEl) nameEl.textContent = `${goal.icon} ${goal.title}`;
    const addBtn = document.getElementById('milestone-timeline-add-btn');
    if(addBtn) addBtn.onclick = () => { closeModal('milestone-timeline-modal'); window.openAddMilestoneModal(goalId); };
    // 모달을 먼저 연 뒤에 콘텐츠를 채워야 refresh 함수의 hidden 체크를 통과함
    if(typeof openModal !== 'undefined') openModal('milestone-timeline-modal');
    window.refreshMilestoneTimelineModal();
}

window.refreshMilestoneTimelineModal = function() {
    if (!currentTimelineGoalId) return;
    const container = document.getElementById('milestone-timeline-modal-content');
    if(!container) return;
    const modal = document.getElementById('milestone-timeline-modal');
    if(modal && modal.classList.contains('hidden')) return;

    const manualMilestones = localMilestones
        .filter(m => m.parent_goal_id === currentTimelineGoalId && (m.type || 'exp') === 'manual')
        .sort((a,b) => {
            const ao = (typeof a.order === 'number') ? a.order : Number.MAX_SAFE_INTEGER;
            const bo = (typeof b.order === 'number') ? b.order : Number.MAX_SAFE_INTEGER;
            if (ao !== bo) return ao - bo;
            return (a.created_at||'').localeCompare(b.created_at||'');
        });

    if (manualMilestones.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-8 font-bold">이 목표에 직접 체크 방식의 마일스톤이 아직 없어요.<br><span class="text-[10px]">아래 [+ 이 목표에 마일스톤 추가] 버튼으로 만들어보세요.</span></div>';
    } else {
        container.innerHTML = window.renderMilestoneTimeline(manualMilestones, currentTimelineGoalId, true);
    }
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// ================= [레벨업 축하 팝업] =================

window.showLevelUpCelebration = function(goal, oldLevel, newLevel) {
    const backdrop = document.createElement('div');
    backdrop.className = 'levelup-celebrate-backdrop';
    backdrop.innerHTML = `
        <div class="levelup-celebrate-card">
            <div class="levelup-sparkles">✨ 🎉 ✨</div>
            <div class="levelup-title">LEVEL UP</div>
            <div class="text-3xl mb-1" style="position:relative;">${goal.icon}</div>
            <div class="levelup-goal-title">${goal.title}</div>
            <div class="levelup-number">
                <span>Lv.${oldLevel}</span><span class="arrow">→</span><span class="new-lv">Lv.${newLevel}</span>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', () => backdrop.remove());
    setTimeout(() => { if(backdrop && backdrop.parentNode) backdrop.remove(); }, 2600);
    if(typeof showToast !== 'undefined') showToast(`⬆️ 레벨업! ${goal.title} Lv.${newLevel}`);
}
