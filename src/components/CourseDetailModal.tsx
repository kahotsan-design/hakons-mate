import { useEffect } from 'react';
import { X, Clock, MapPin, User, GraduationCap, CalendarDays, Pencil } from 'lucide-react';
import type { Course } from '../types';
import { useLang, appDayLong } from '../i18n';

interface CourseDetailModalProps {
  course: Course;
  onClose: () => void;
  /** 傳入則顯示"編輯"按鈕（港城大模塊）；首頁不傳則顯示去編輯提示 */
  onEdit?: () => void;
}

/**
 * 課程詳情彈層（底部抽屜樣式）
 * 點擊課表網格中的課程塊彈出，顯示完整課程信息
 */
export default function CourseDetailModal({ course, onClose, onEdit }: CourseDetailModalProps) {
  const { lang, t } = useLang();
  const weekText = course.weeks && course.weeks.length > 0
    ? (course.weeks.length >= 13
        ? t('campus.weeksFull')
        : t('courseDetail.weeksValue', { a: course.weeks[0], b: course.weeks[course.weeks.length - 1] }))
    : '';

  // 打開時鎖定頁面所有可滾動容器，關閉時恢復——防止滑動穿透到背景
  useEffect(() => {
    const scrollables: { el: HTMLElement; prev: string }[] = [];
    document.querySelectorAll<HTMLElement>('.page-scroll').forEach(el => {
      scrollables.push({ el, prev: el.style.overflow });
      el.style.overflow = 'hidden';
    });
    const bodyPrev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      scrollables.forEach(({ el, prev }) => { el.style.overflow = prev; });
      document.body.style.overflow = bodyPrev;
    };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%',
        /* 高度跟 JS 寫入的真實可視高度（--app-h）：iOS Safari 地址欄展開時
           100vh/layout viewport 比可視區高出 ~90px，貼 viewport 會讓底部按鈕
           被地址欄蓋住、遮罩超出 root 露出 html 藍底「色塊」。
           --app-h 跟隨 visualViewport（地址欄/鍵盤態），永遠貼合可視區 */
        height: 'var(--app-h, 100vh)',
        background: 'rgba(31, 58, 89,0.62)',
        zIndex: 1000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        touchAction: 'none',
        animation: 'modalFade 0.18s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--color-card)',
          borderRadius: '20px 20px 0 0',
          padding: '18px 18px 30px',
          maxHeight: '80vh',
          overscrollBehavior: 'contain',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          animation: 'itemSlideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1) both',
          boxShadow: '0 -8px 30px rgba(15,23,42,0.15)',
        }}
      >
        {/* 頂部抓手 + 關閉 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 100, background: 'var(--color-border)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{
            padding: '4px 8px', borderRadius: 6,
            fontSize: 11, fontWeight: 700, color: '#0b2136',
            background: course.color, marginTop: 2,
          }}>{course.code}</div>
          <X size={22} color="var(--color-text-tertiary)" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>

        {/* 課程名 */}
        <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 16, lineHeight: 1.3 }}>
          {course.name}
        </div>

        {/* 信息 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 18 }}>
          <InfoRow icon={<CalendarDays size={15} />} label={t('courseDetail.weekday')} value={appDayLong(lang, course.dayOfWeek)} />
          <InfoRow icon={<Clock size={15} />} label={t('courseDetail.time')} value={`${course.startTime} - ${course.endTime}`} />
          {course.location && <InfoRow icon={<MapPin size={15} />} label={t('courseDetail.room')} value={course.location} />}
          {course.teacher && <InfoRow icon={<User size={15} />} label={t('courseDetail.teacher')} value={course.teacher} />}
          {course.teacherEmail && <InfoRow icon={<User size={15} />} label={t('courseDetail.teacherEmail')} value={course.teacherEmail} />}
          <InfoRow icon={<GraduationCap size={15} />} label={t('courseDetail.creditsLabel')} value={t('courseDetail.creditsValue', { n: course.credits })} />
          {weekText && <InfoRow icon={<CalendarDays size={15} />} label={t('courseDetail.weeksLabel')} value={weekText} />}
          {course.officeHour && <InfoRow icon={<Clock size={15} />} label="Office Hour" value={course.officeHour} />}
        </div>

        {course.gradeComposition && (
          <div style={{ background: 'var(--color-bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>{t('courseDetail.grading')}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{course.gradeComposition}</div>
          </div>
        )}

        {course.canvasLink && (
          <a href={course.canvasLink} target="_blank" rel="noreferrer" style={{
            display: 'block', textAlign: 'center',
            padding: '10px 0', borderRadius: 10,
            background: 'var(--color-campus-bg)',
            color: 'var(--color-campus)', fontSize: 13, fontWeight: 600,
            textDecoration: 'none', marginBottom: 12,
          }}>{t('campus.openCanvas')}</a>
        )}

        {/* 按鈕 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid var(--color-border)',
            background: 'var(--color-card)', color: 'var(--color-text-secondary)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>{t('courseDetail.close')}</button>
          {onEdit ? (
            <button onClick={onEdit} style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
              background: 'var(--color-campus)', color: '#0b2136',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}><Pencil size={15} />{t('courseDetail.edit')}</button>
          ) : (
            <div style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              background: 'var(--color-bg)', color: 'var(--color-text-tertiary)',
              fontSize: 12, fontWeight: 600, textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{t('courseDetail.editHint')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--color-text-tertiary)', display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', width: 64, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0, overflowWrap: 'break-word' }}>{value}</span>
    </div>
  );
}
