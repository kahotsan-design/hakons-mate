import { useState } from 'react';
import { Dumbbell, Scale, Plus, Clock, Trash2, X, Apple, Utensils, Coffee, Cookie, Flame, Pencil, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useLocalStorage, genId } from '../hooks/useLocalStorage';
import EmptyState from '../components/EmptyState';
import DateSlider from '../components/DateSlider';
import RailNav from '../components/RailNav';
import EnergyJar from '../components/EnergyJar';
import { SnowGrain } from '../components/SnowFX';
import { useLang, trCategory } from '../i18n';
import { callDeepSeek } from '../utils/deepseek';
import type { MealRecord, ExerciseRecord, WeightRecord } from '../types';
import { playSound } from '../utils/sound';

// 本地時間格式化日期
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 根據體重、身高、年齡計算減肥每日攝入量（Mifflin-St Jeor 公式）
function calcDailyTarget(weightKg: number, heightCm = 170, age = 22, isMale = true): number {
  if (weightKg <= 0) return 2000;
  // Mifflin-St Jeor BMR 公式
  const bmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  // 輕度活動 ×1.375，減肥赤字 500kcal → 每週約減0.5kg
  return Math.round(bmr * 1.375 - 500);
}

type Tab = 'diet' | 'exercise' | 'weight';

export default function Fitness() {
  const [tab, setTab] = useState<Tab>('diet');
  const { t } = useLang();

  return (
    <div className="page fade-in">
      {/* 固定標題（藍塊只放標題，全 App 統一高度） */}
      <div className="page-header">
        <div className="page-title">{t('title.fitness')}</div>
      </div>

      {/* 可滾動內容 */}
      <div className="page-scroll">
        {/* 中心聚焦導航：中心模塊最大最清晰，兩側縮小弱化，可左右滑動切換 */}
        <RailNav
          tabs={[
            { key: 'diet', label: t('fitness.tab.diet'), icon: Utensils },
            { key: 'exercise', label: t('fitness.tab.exercise'), icon: Dumbbell },
            { key: 'weight', label: t('fitness.tab.weight'), icon: Scale },
          ]}
          active={tab}
          onChange={k => setTab(k as Tab)}
        />
        <div key={tab} className="rail-view">
          {tab === 'diet' && <DietView />}
          {tab === 'exercise' && <ExerciseView />}
          {tab === 'weight' && <WeightView />}
        </div>
      </div>
    </div>
  );
}

// ============ 飲食記錄 ============
function DietView() {
  const { t } = useLang();
  const [meals, setMeals] = useLocalStorage<MealRecord[]>('fitness_meals', []);
  const [weights] = useLocalStorage<WeightRecord[]>('fitness_weights', []);
  const [height] = useLocalStorage<number>('fitness_height', 0);
  const [age] = useLocalStorage<number>('fitness_age', 0);
  const [isMale] = useLocalStorage<boolean>('fitness_is_male', true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [editingMeal, setEditingMeal] = useState<MealRecord | null>(null);
  const [reestimatingAll, setReestimatingAll] = useState(false);
  // 保存成功雪粒彩蛋：计数触发，1.3 秒后自动清零（視覺層，不影響保存邏輯）
  const [grainFx, setGrainFx] = useState(0);
  const triggerGrain = () => {
    setGrainFx(f => f + 1);
    setTimeout(() => setGrainFx(0), 1300);
  };
  const today = todayLocal();
  const isToday = selectedDate === today;

  const dayMeals = meals.filter(m => m.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const dayCalories = dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);

  // 獲取最新體重計算減肥攝入量（使用身體數據）
  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const currentWeight = sortedWeights[sortedWeights.length - 1]?.weight || 0;
  const dailyTarget = calcDailyTarget(currentWeight, height || 170, age || 22, isMale);

  // 是否已超過晚上10點（判斷當天是否"結賬"）
  const nowHour = new Date().getHours();
  const isAfterCheckout = nowHour >= 22;

  // 熱量狀態配色：奶黃紙 + 暖棕字（用戶（用戶欽點好看）。歷史日期也用不透明奶黃——
  const deleteMeal = (id: string) => setMeals(prev => prev.filter(m => m.id !== id));

  const updateMeal = (updated: MealRecord) => {
    setMeals(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  // 重新估算所有餐食的熱量
  const reestimateAll = async () => {
    setReestimatingAll(true);
    const allMeals = [...meals];
    for (let i = 0; i < allMeals.length; i++) {
      const meal = allMeals[i];
      const items = meal.manualItems || meal.recognizedItems || [];
      if (items.length > 0) {
        const nutrition = await autoEstimateCalories(items);
        if (nutrition) {
          allMeals[i] = {
            ...meal,
            calories: nutrition.calories,
            nutrition: { protein: nutrition.protein, fat: nutrition.fat, carbs: nutrition.carbs },
          };
        }
      }
    }
    setMeals(allMeals);
    setReestimatingAll(false);
  };

  if (editingMeal) {
    return <EditMealForm meal={editingMeal} onSave={async (m) => { updateMeal(m); setEditingMeal(null); triggerGrain(); }} onCancel={() => setEditingMeal(null)} />;
  }

  if (showAdd) {
    return <AddMealForm onAdd={async (m) => { setMeals(prev => [...prev, m]); setShowAdd(false); triggerGrain(); }} onCancel={() => setShowAdd(false)} />;
  }

  const mealTypeConfig = {
    breakfast: { label: t('fitness.breakfast'), icon: Coffee, color: '#B3865C' },
    lunch: { label: t('fitness.lunch'), icon: Utensils, color: '#2E86B8' },
    dinner: { label: t('fitness.dinner'), icon: Utensils, color: '#A79BC2' },
    snack: { label: t('fitness.snack'), icon: Cookie, color: '#2E86B8' },
  };

  return (
    <div>
      <DateSlider selectedDate={selectedDate} onChange={setSelectedDate} />

      {/* 熱量儀表盤 → 手繪儲能壺場景 */}
      {isToday && currentWeight > 0 && (
        <EnergyJar
          dayCalories={dayCalories}
          dailyTarget={dailyTarget}
          isAfterCheckout={isAfterCheckout}
        />
      )}

      {isToday && !currentWeight && (
        <div style={{
          padding: '14px 16px', borderRadius: 12, marginBottom: 16,
          background: 'linear-gradient(135deg, #FBF2D9 0%, #F6E9C4 100%)', border: '1.5px dashed rgba(110,90,53,0.45)',
          fontSize: 13, fontWeight: 500, color: '#6E5A35', textAlign: 'center',
        }}>
          {t('fitness.goWeight2')}
        </div>
      )}

      {/* 非今天的熱量彙總 */}
      {!isToday && dayCalories > 0 && (
        <div style={{
          padding: '10px 16px', borderRadius: 12, marginBottom: 12,
          background: 'linear-gradient(135deg, #FBF2D9 0%, #F6E9C4 100%)', border: '1.5px solid rgba(110,90,53,0.28)', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#6E5A35' }}>{t('fitness.totalToday')}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#8A5A28' }}>
            <Flame size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {dayCalories} {t('fitness.kcal')}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#FDFEFE' }}>
          {t('fitness.nRecords', { n: dayMeals.length })}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{ ...btnSecondary, padding: '6px 10px', borderRadius: 100, fontSize: 11 }}
            onClick={reestimateAll}
            disabled={reestimatingAll}
          >
            {reestimatingAll ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-fitness)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                {t('fitness.estimating')}
              </span>
            ) : (
              <><RefreshCw size={12} style={{ verticalAlign: 'middle' }} /> {t('fitness.reestimate')}</>
            )}
          </button>
          <button style={btnAdd} onClick={() => setShowAdd(true)}><Plus size={14} /> {t('fitness.logMeal')}</button>
        </div>
      </div>

      {dayMeals.length === 0 ? (
        <EmptyState
          icon={Apple}
          art="/art/bear-empty.svg"
          title={t('fitness.noMeal')}
          desc={t('fitness.noMealDesc')}
          actionLabel={t('fitness.addMeal')}
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <>
          <div className="section-title"><Apple size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{t('fitness.mealLog')}</div>
          {/* 飲食記錄列表：relative 容器承載保存成功的右下角雪粒彩蛋 */}
          <div style={{ position: 'relative' }}>
          {dayMeals.map(meal => {
            const cfg = mealTypeConfig[meal.type];
            const MealIcon = cfg.icon;
            const items = meal.recognizedItems || meal.manualItems || [];
            return (
              <div key={meal.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: items.length > 0 ? 8 : 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MealIcon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{cfg.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                      <Clock size={14} style={{ verticalAlign: 'middle' }} /> {meal.time}
                    </span>
                  </div>
                  {meal.calories && (
                    <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'var(--color-fitness-bg)', color: 'var(--color-fitness)', flexShrink: 0 }}>
                      <Flame size={14} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                      {meal.calories} {t('fitness.kcal')}
                    </span>
                  )}
                  <Pencil size={16} style={{ color: 'var(--color-text-secondary)', cursor: 'pointer', flexShrink: 0 }} onClick={() => setEditingMeal(meal)} />
                  <Trash2 size={16} style={{ color: 'var(--color-danger)', cursor: 'pointer', flexShrink: 0 }} onClick={() => deleteMeal(meal.id)} />
                </div>
                {items.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((item, i) => (
                      <span key={i} style={{ padding: '3px 10px', borderRadius: 100, fontSize: 12, background: 'var(--color-fitness-bg)', color: 'var(--color-fitness)' }}>{item}</span>
                    ))}
                  </div>
                )}
                {meal.nutrition && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    <span>{t('fitness.protein', { n: meal.nutrition.protein })}</span>
                    <span>{t('fitness.fat', { n: meal.nutrition.fat })}</span>
                    <span>{t('fitness.carbs', { n: meal.nutrition.carbs })}</span>
                  </div>
                )}
                {meal.notes && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}>{meal.notes}</div>}
              </div>
            );
          })}
          {/* 保存成功：右下角少量小雪粒短時動畫，完成後自動消失 */}
          {grainFx > 0 && <SnowGrain />}
          </div>
        </>
      )}
    </div>
  );
}

// 自動調用 AI 估算熱量的函數
async function autoEstimateCalories(foodItems: string[]): Promise<{ calories: number; protein: number; fat: number; carbs: number } | null> {
  if (foodItems.length === 0) return null;

  try {
    const prompt = `請估算以下食物的熱量和營養素含量。輸出純JSON（不要markdown代碼塊）：

{
  "calories": 總熱量數字（千卡）,
  "protein": 蛋白質克數（數字）,
  "fat": 脂肪克數（數字）,
  "carbs": 碳水克數（數字）
}

【重要】這是給一個成年男性（不偏胖，正常體型）吃的。用户只輸入了菜品名稱，沒有稱重數據。你需要按照成年男性正常一餐的食量來估算每道菜的大概份量和熱量。比如：
- 一碗米飯 ≈ 200g ≈ 230千卡
- 一份番茄炒蛋 ≈ 250g ≈ 200千卡
- 一份紅燒肉 ≈ 200g ≈ 480千卡
- 一碗湯麪 ≈ 500g ≈ 400千卡

請基於「一個正常成年男性的一餐份量」來估算，不要假設是減肥餐或超大份。

食物清單：${foodItems.join('、')}`;

    const result = await callDeepSeek([
      { role: 'system', content: '你是一個專業的營養師AI助手。請始終輸出純淨的JSON，不要加markdown代碼塊標記。估算熱量時按照成年男性正常食量的份量來計算，不需要用户提供重量。' },
      { role: 'user', content: prompt },
    ], 0.2);

    if (result) {
      try {
        const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const data = JSON.parse(cleaned);
        return {
          calories: data.calories || 0,
          protein: data.protein || 0,
          fat: data.fat || 0,
          carbs: data.carbs || 0,
        };
      } catch {
        const calMatch = result.match(/熱量[：:]\s*(\d+)/) || result.match(/calories[：:]\s*(\d+)/i) || result.match(/(\d+)\s*(千卡|kcal)/);
        if (calMatch) {
          return { calories: parseInt(calMatch[1]), protein: 0, fat: 0, carbs: 0 };
        }
      }
    }
  } catch (e) {
    console.error('AI估算失敗:', e);
  }
  return null;
}

function AddMealForm({ onAdd, onCancel }: { onAdd: (m: MealRecord) => Promise<void>; onCancel: () => void }) {
  const { t } = useLang();
  const [type, setType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [date, setDate] = useState(todayLocal());
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [items, setItems] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const foodItems = items.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (foodItems.length === 0) { alert(t('fitness.alertFood')); return; }

    setSubmitting(true);
    const nutrition = await autoEstimateCalories(foodItems);
    setSubmitting(false);

    await onAdd({
      id: genId(), type, time, date,
      manualItems: foodItems,
      notes: notes || undefined,
      calories: nutrition?.calories,
      nutrition: nutrition ? { protein: nutrition.protein, fat: nutrition.fat, carbs: nutrition.carbs } : undefined,
    });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('fitness.logMeal')}</span>
        <X size={20} style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }} onClick={onCancel} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('fitness.f.mealType')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(key => (
            <button key={key} onClick={() => setType(key)} style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: type === key ? 'var(--color-fitness)' : '#FDFEFE',
              color: type === key ? '#FDFEFE' : 'var(--color-text-secondary)',
              border: type === key ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
            }}>{t(`fitness.${key}` as any)}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('common.date')}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('common.time')}</div>
        <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          {t('fitness.f.whatAte')} <span style={{ color: 'var(--color-fitness)', fontSize: 11 }}>{t('fitness.f.aiEstimate')}</span>
        </div>
        <input type="text" value={items} onChange={e => setItems(e.target.value)} placeholder={t('fitness.f.whatAtePh')} style={inputStyle} />
      </div>

      <FormField label={t('common.notesOptional')} value={notes} onChange={setNotes} placeholder={t('fitness.f.notesPh')} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} disabled={submitting} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} disabled={submitting || !items.trim()} style={{
          ...btnPrimary, flex: 1, padding: '10px',
          opacity: submitting || !items.trim() ? 0.5 : 1,
        }}>
          {submitting ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              {t('fitness.f.aiEstimating')}
            </span>
          ) : t('common.confirm')}
        </button>
      </div>
    </div>
  );
}

// ============ 編輯飲食記錄 ============
function EditMealForm({ meal, onSave, onCancel }: { meal: MealRecord; onSave: (m: MealRecord) => Promise<void>; onCancel: () => void }) {
  const { t } = useLang();
  const [type, setType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(meal.type);
  const [date, setDate] = useState(meal.date);
  const [time, setTime] = useState(meal.time);
  const [items, setItems] = useState((meal.manualItems || meal.recognizedItems || []).join('，'));
  const [notes, setNotes] = useState(meal.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [reestimate, setReestimate] = useState(false);

  const submit = async () => {
    const foodItems = items.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (foodItems.length === 0) { alert(t('fitness.alertFood')); return; }

    setSubmitting(true);
    let nutrition = meal.nutrition;
    let calories = meal.calories;

    // 如果食物內容變了或用户選擇了重新估算，調用AI
    const originalItems = (meal.manualItems || meal.recognizedItems || []).join('，');
    if (reestimate || items !== originalItems) {
      const result = await autoEstimateCalories(foodItems);
      if (result) {
        nutrition = { protein: result.protein, fat: result.fat, carbs: result.carbs };
        calories = result.calories;
      }
    }

    setSubmitting(false);

    await onSave({
      ...meal,
      type, time, date,
      manualItems: foodItems,
      recognizedItems: undefined,
      notes: notes || undefined,
      calories,
      nutrition,
    });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('fitness.editMeal')}</span>
        <X size={20} style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }} onClick={onCancel} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('fitness.f.mealType')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(key => (
            <button key={key} onClick={() => setType(key)} style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: type === key ? 'var(--color-fitness)' : '#FDFEFE',
              color: type === key ? '#FDFEFE' : 'var(--color-text-secondary)',
              border: type === key ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
            }}>{t(`fitness.${key}` as any)}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('common.date')}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('common.time')}</div>
        <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          {t('fitness.f.whatAte')}
        </div>
        <input type="text" value={items} onChange={e => setItems(e.target.value)} placeholder={t('fitness.f.whatAtePh')} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={reestimate} onChange={e => setReestimate(e.target.checked)} style={{ width: 16, height: 16 }} />
          {t('fitness.reestimateCk')}
        </label>
        {meal.calories && !reestimate && (
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            {t('fitness.keepCurrent', { n: meal.calories })}
          </span>
        )}
      </div>

      <FormField label={t('common.notesOptional')} value={notes} onChange={setNotes} placeholder={t('fitness.f.notesPh')} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} disabled={submitting} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} disabled={submitting || !items.trim()} style={{
          ...btnPrimary, flex: 1, padding: '10px',
          opacity: submitting || !items.trim() ? 0.5 : 1,
        }}>
          {submitting ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              {t('fitness.f.aiEstimating')}
            </span>
          ) : t('common.saveChanges')}
        </button>
      </div>
    </div>
  );
}

// ============ 運動記錄 ============
function ExerciseView() {
  const { lang, t } = useLang();
  const [exercises, setExercises] = useLocalStorage<ExerciseRecord[]>('fitness_exercises', []);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const dayExercises = exercises.filter(e => e.date === selectedDate);

  const deleteExercise = (id: string) => setExercises(prev => prev.filter(e => e.id !== id));

  if (showAdd) {
    return <AddExerciseForm onAdd={(e) => { setExercises(prev => [...prev, e]); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />;
  }

  const totalMinutes = dayExercises.reduce((sum, e) => sum + e.duration, 0);

  return (
    <div>
      <DateSlider selectedDate={selectedDate} onChange={setSelectedDate} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {t('fitness.ex.nSessions', { n: dayExercises.length, n2: totalMinutes })}
        </span>
        <button style={btnAdd} onClick={() => setShowAdd(true)}><Plus size={14} /> {t('fitness.ex.log')}</button>
      </div>

      {dayExercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          art="/art/bear-empty.svg"
          title={t('fitness.ex.none')}
          desc={t('fitness.ex.noneDesc')}
          actionLabel={t('fitness.ex.add')}
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <>
          <div className="section-title"><Dumbbell size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{t('fitness.ex.logTitle')}</div>
          {dayExercises.map(ex => (
            <div key={ex.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-fitness-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Dumbbell size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{trCategory(ex.category, lang)}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  <Clock size={14} style={{ verticalAlign: 'middle' }} /> {ex.time} · {t('fitness.ex.durationMin', { n: ex.duration })}
                </div>
              </div>
              {ex.exerciseType && (
                <span style={{
                  padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, flexShrink: 0,
                  background: ex.exerciseType === 'cardio' ? 'rgba(125,211,252,0.16)' : 'rgba(201,168,232,0.16)',
                  color: ex.exerciseType === 'cardio' ? '#2E86B8' : '#A79BC2',
                }}>
                  {ex.exerciseType === 'cardio' ? t('fitness.ex.cardio') : trCategory(ex.category, lang)}
                </span>
              )}
              <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 13, fontWeight: 700, background: 'var(--color-fitness)', color: '#0b2136' }}>{ex.duration}min</span>
              <Trash2 size={16} style={{ color: 'var(--color-danger)', cursor: 'pointer' }} onClick={() => deleteExercise(ex.id)} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AddExerciseForm({ onAdd, onCancel }: { onAdd: (e: ExerciseRecord) => void; onCancel: () => void }) {
  const { lang, t } = useLang();
  const [category, setCategory] = useState('');
  const [exerciseType, setExerciseType] = useState<'cardio' | 'strength'>('cardio');
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));

  // 存儲規範值保持中文不變（純顯示層翻譯，老數據不受影響）
  const cardioCategories = ['爬樓機', '跑步機爬坡', '跑步', '快走', '跳繩', 'HIIT', '游泳', '騎行', '橢圓機', '划船機', '其他'];
  const strengthCategories = ['練胸', '練背', '練腿', '練肩', '練手臂', '練腹', '全身力量', '其他'];

  const currentCategories = exerciseType === 'cardio' ? cardioCategories : strengthCategories;

  const submit = () => {
    if (!category) { alert(t('fitness.ex.alertCat')); return; }
    if (!duration || parseInt(duration) <= 0) { alert(t('fitness.ex.alertDur')); return; }
    playSound('success');
    onAdd({ id: genId(), category, exerciseType, duration: parseInt(duration), time, date });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('fitness.ex.log')}</span>
        <X size={20} style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }} onClick={onCancel} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('fitness.ex.f.type')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setExerciseType('cardio'); setCategory(''); }} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: exerciseType === 'cardio' ? 'var(--color-fitness)' : '#FDFEFE',
            color: exerciseType === 'cardio' ? '#FDFEFE' : 'var(--color-text-secondary)',
            border: exerciseType === 'cardio' ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
          }}>{t('fitness.ex.f.cardioBtn')}</button>
          <button onClick={() => { setExerciseType('strength'); setCategory(''); }} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: exerciseType === 'strength' ? 'var(--color-fitness)' : '#FDFEFE',
            color: exerciseType === 'strength' ? '#FDFEFE' : 'var(--color-text-secondary)',
            border: exerciseType === 'strength' ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
          }}>{t('fitness.ex.f.strengthBtn')}</button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          {exerciseType === 'cardio' ? t('fitness.ex.f.cardioItems') : t('fitness.ex.f.bodyParts')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {currentCategories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} style={{
              flex: '1 1 30%', padding: '7px 2px', borderRadius: 100, cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap',
              background: category === cat ? 'var(--color-fitness)' : '#FDFEFE',
              color: category === cat ? '#FDFEFE' : 'var(--color-text-secondary)',
              border: category === cat ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
            }}>{trCategory(cat, lang)}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('common.date')}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('common.time')}</div>
        <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('fitness.ex.f.duration')}</div>
        <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder={t('fitness.ex.f.durationPh')} style={inputStyle} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>{t('common.confirm')}</button>
      </div>
    </div>
  );
}

// ============ 體重追蹤 ============
function WeightView() {
  const { t } = useLang();
  const [weights, setWeights] = useLocalStorage<WeightRecord[]>('fitness_weights', []);
  const [targetWeight, setTargetWeight] = useLocalStorage<number>('fitness_target_weight', 0);
  const [height, setHeight] = useLocalStorage<number>('fitness_height', 0);
  const [age, setAge] = useLocalStorage<number>('fitness_age', 0);
  const [isMale, setIsMale] = useLocalStorage<boolean>('fitness_is_male', true);
  const [showAdd, setShowAdd] = useState(false);
  const [showSetTarget, setShowSetTarget] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const deleteWeight = (id: string) => setWeights(prev => prev.filter(w => w.id !== id));

  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1]?.weight || 0;
  const previous = sorted[sorted.length - 2]?.weight || 0;
  const diff = previous ? (current - previous).toFixed(1) : '0.0';
  const toGoal = targetWeight ? (current - targetWeight).toFixed(1) : '?';

  // 每日減肥攝入量（需要身高年齡）
  const dailyTarget = calcDailyTarget(current, height || 170, age || 22, isMale);

  if (showAdd) {
    return <AddWeightForm onAdd={(w) => { setWeights(prev => [...prev, w]); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />;
  }

  if (showSetTarget) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{t('fitness.wt.f.setTarget')}</span>
          <X size={20} style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }} onClick={() => setShowSetTarget(false)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('fitness.wt.f.targetWeight')}</div>
          <input type="number" step="0.1" defaultValue={targetWeight || ''} onChange={e => setTargetWeight(parseFloat(e.target.value) || 0)} placeholder={t('fitness.wt.f.targetPh')} style={inputStyle} />
        </div>
        <button onClick={() => setShowSetTarget(false)} style={{ ...btnPrimary, width: '100%', padding: '10px' }}>{t('common.confirm')}</button>
      </div>
    );
  }

  if (showProfile) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{t('fitness.wt.bodyData')}</span>
          <X size={20} style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }} onClick={() => setShowProfile(false)} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          {t('fitness.wt.f.bodyDataDesc')}
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('fitness.wt.f.height')}</div>
          <input type="number" defaultValue={height || ''} onChange={e => setHeight(parseInt(e.target.value) || 0)} placeholder={t('fitness.wt.f.heightPh')} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('fitness.wt.f.age')}</div>
          <input type="number" defaultValue={age || ''} onChange={e => setAge(parseInt(e.target.value) || 0)} placeholder={t('fitness.wt.f.agePh')} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('fitness.wt.f.gender')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setIsMale(true)} style={{
              flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: isMale ? 'var(--color-fitness)' : '#FDFEFE',
              color: isMale ? '#FDFEFE' : 'var(--color-text-secondary)',
              border: isMale ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
            }}>{t('fitness.wt.male')}</button>
            <button onClick={() => setIsMale(false)} style={{
              flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: !isMale ? 'var(--color-fitness)' : '#FDFEFE',
              color: !isMale ? '#FDFEFE' : 'var(--color-text-secondary)',
              border: !isMale ? '1.5px solid #FDFEFE' : '1.5px solid rgba(46, 110, 168, 0.42)',
            }}>{t('fitness.wt.female')}</button>
          </div>
        </div>
        <button onClick={() => setShowProfile(false)} style={{ ...btnPrimary, width: '100%', padding: '10px' }}>{t('common.confirm')}</button>
      </div>
    );
  }

  // 趨勢圖數據
  const chartHeight = 120;
  const chartWidth = 300;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button style={btnAdd} onClick={() => setShowAdd(true)}><Plus size={14} /> {t('fitness.wt.log')}</button>
        <button style={{ ...btnSecondary, padding: '6px 12px', borderRadius: 100, fontSize: 12 }} onClick={() => setShowSetTarget(true)}><Scale size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('fitness.wt.setGoal')}</button>
        <button style={{ ...btnSecondary, padding: '6px 12px', borderRadius: 100, fontSize: 12 }} onClick={() => setShowProfile(true)}><Scale size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('fitness.wt.bodyData')}</button>
      </div>

      {weights.length === 0 ? (
        <EmptyState
          icon={Scale}
          art="/art/bear-empty.svg"
          title={t('fitness.wt.none')}
          desc={t('fitness.wt.noneDesc')}
          actionLabel={t('fitness.wt.log')}
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <>
          {/* 當前體重 + 每日攝入建議 */}
          <div className="card" style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{t('fitness.wt.current')}</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--color-fitness)', margin: '4px 0' }}>
              {current}<span style={{ fontSize: 16, color: 'var(--color-text-secondary)' }}> kg</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 13, flexWrap: 'wrap' }}>
              {previous > 0 && (
                <span style={{ color: parseFloat(diff) <= 0 ? 'var(--color-success)' : 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {parseFloat(diff) <= 0 ? <TrendingDown size={14} strokeWidth={2.4} /> : <TrendingUp size={14} strokeWidth={2.4} />} {t('fitness.wt.vsLast', { n: Math.abs(parseFloat(diff)) })}
                </span>
              )}
              {targetWeight > 0 && (
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {toGoal !== '?' && parseFloat(toGoal) > 0 ? t('fitness.wt.goalLine', { n: targetWeight, d: toGoal }) : t('fitness.wt.goalReached', { n: targetWeight })}
                </span>
              )}
            </div>
            {/* 每日最佳攝入量 */}
            <div style={{
              marginTop: 14, padding: '10px 16px', borderRadius: 10,
              background: 'var(--color-fitness-bg)', display: 'inline-block',
            }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}><Dumbbell size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('fitness.wt.dailyIntake')}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-fitness)' }}>
                <Flame size={18} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {dailyTarget} {t('fitness.kcal')}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                {t('fitness.wt.formulaDesc', { w: current, h: height || 170, a: age || 22, g: isMale ? t('fitness.wt.male') : t('fitness.wt.female') })}
              </div>
            </div>
          </div>

          {/* 趨勢圖 */}
          {sorted.length >= 2 && (
            <>
              <div className="section-title"><Scale size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{t('fitness.wt.trend')}</div>
              <div className="card">
                {(() => {
                  const allValues = targetWeight > 0 ? [...sorted.map(w => w.weight), targetWeight] : sorted.map(w => w.weight);
                  const minW = Math.min(...allValues) - 1;
                  const maxW = Math.max(...allValues) + 1;
                  const range = maxW - minW || 1;
                  const points = sorted.map((w, i) => ({
                    x: (i / (sorted.length - 1)) * chartWidth,
                    y: chartHeight - ((w.weight - minW) / range) * chartHeight,
                    weight: w.weight, date: w.date,
                  }));
                  return (
                    <svg width="100%" viewBox={`0 0 ${chartWidth + 40} ${chartHeight + 40}`} style={{ display: 'block' }}>
                      {targetWeight > 0 && (
                        <>
                          <line x1="0" y1={chartHeight - ((targetWeight - minW) / range) * chartHeight} x2={chartWidth} y2={chartHeight - ((targetWeight - minW) / range) * chartHeight} stroke="#2E86B8" strokeWidth="1" strokeDasharray="4 4" />
                          <text x={chartWidth - 50} y={chartHeight - ((targetWeight - minW) / range) * chartHeight - 5} fill="#2E86B8" fontSize="10">{t('fitness.wt.goalN', { n: targetWeight })}</text>
                        </>
                      )}
                      <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--color-fitness)" strokeWidth="2" />
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="4" fill="var(--color-fitness)" />
                          <text x={p.x} y={p.y - 10} fill="var(--color-text)" fontSize="10" textAnchor="middle">{p.weight}</text>
                          <text x={p.x} y={chartHeight + 20} fill="var(--color-text-tertiary)" fontSize="9" textAnchor="middle">{p.date.slice(5)}</text>
                        </g>
                      ))}
                    </svg>
                  );
                })()}
              </div>
            </>
          )}

          {/* 歷史記錄 */}
          <div className="section-title"><Clock size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{t('fitness.wt.history')}</div>
          {sorted.slice().reverse().map(w => (
            <div key={w.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{w.date}</span>
                {w.note && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 8 }}>{w.note}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-fitness)' }}>{w.weight} kg</span>
                <Trash2 size={14} style={{ color: 'var(--color-danger)', cursor: 'pointer' }} onClick={() => deleteWeight(w.id)} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AddWeightForm({ onAdd, onCancel }: { onAdd: (w: WeightRecord) => void; onCancel: () => void }) {
  const { t } = useLang();
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState('');

  const submit = () => {
    if (!weight || parseFloat(weight) <= 0) { alert(t('fitness.wt.alertWeight')); return; }
    playSound('success');
    onAdd({ id: genId(), weight: parseFloat(weight), date, note: note || undefined });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('fitness.wt.log')}</span>
        <X size={20} style={{ cursor: 'pointer', color: 'var(--color-text-tertiary)' }} onClick={onCancel} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('fitness.wt.f.weightKg')}</div>
        <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder={t('fitness.wt.f.weightPh')} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{t('common.date')}</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>
      <FormField label={t('common.notesOptional')} value={note} onChange={setNote} placeholder={t('fitness.wt.f.notePh')} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onCancel} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>{t('common.cancel')}</button>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1, padding: '10px' }}>{t('common.confirm')}</button>
      </div>
    </div>
  );
}

// ============ 共用 ============
function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</div><input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} /></div>;
}

const inputStyle = { width: '100%', height: 44, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 16, outline: 'none', background: 'var(--color-snow)', boxSizing: 'border-box' as const, WebkitAppearance: 'none' as const, appearance: 'none' as const };
const btnPrimary = { padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--color-fitness)', color: '#0b2136', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const;
const btnSecondary = { padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(46, 110, 168, 0.40)', background: 'rgba(251, 252, 254, 0.92)', color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const;
const btnAdd = { padding: '6px 12px', borderRadius: 100, border: 'none', background: 'var(--gradient-ice)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap' as const } as const;
