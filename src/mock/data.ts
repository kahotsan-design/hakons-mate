import type {
  Course, Task, Email, JobApplication, InterviewReview,
  MealRecord, ExerciseRecord, WeightRecord, TimelineEvent
} from '../types';

// ============ 課程數據 ============
export const mockCourses: Course[] = [
  {
    id: 'c1',
    name: '數據分析',
    code: 'MA5200',
    teacher: '李教授',
    teacherEmail: 'scli@cityu.edu.hk',
    location: 'AC2-3501',
    dayOfWeek: 3, // 週三
    startTime: '14:00',
    endTime: '15:30',
    weeks: [1,2,3,4,5,6,7,8,9,10,11,12,13],
    credits: 3,
    color: '#7FAFD4',
    canvasLink: 'https://canvas.cityu.edu.hk/courses/12345',
    officeHour: '週三 16:00-17:00',
    gradeComposition: '作業30% + 期中30% + 期末40%',
  },
  {
    id: 'c2',
    name: '軟件工程',
    code: 'COMP5001',
    teacher: '王教授',
    teacherEmail: 'cwang@cityu.edu.hk',
    location: 'AC1-4502',
    dayOfWeek: 3, // 週三
    startTime: '20:00',
    endTime: '22:00',
    weeks: [1,2,3,4,5,6,7,8,9,10,11,12,13],
    credits: 4,
    color: '#E2C289',
    canvasLink: 'https://canvas.cityu.edu.hk/courses/12346',
    officeHour: '週五 14:00-15:00',
    gradeComposition: 'Project40% + 作業20% + 期末40%',
  },
  {
    id: 'c3',
    name: '市場營銷',
    code: 'MKT3501',
    teacher: '陳教授',
    teacherEmail: 'cfchen@cityu.edu.hk',
    location: 'AC2-2105',
    dayOfWeek: 1, // 週一
    startTime: '10:00',
    endTime: '12:00',
    weeks: [1,2,3,4,5,6,7,8,9,10,11,12,13],
    credits: 3,
    color: '#8AC0A9',
    officeHour: '週二 15:00-16:00',
    gradeComposition: '小組項目35% + 個人作業25% + 期末40%',
  },
];

// ============ 任務數據 ============
export const mockTasks: Task[] = [
  {
    id: 't1',
    title: '交COMP5001作業（Project Proposal）',
    courseId: 'c2',
    module: 'campus',
    deadline: '2026-10-16',
    priority: 'high',
    completed: false,
    createdAt: '2026-10-10',
    subTasks: [
      { id: 'st1', title: '查資料', completed: true },
      { id: 'st2', title: '列大綱', completed: true },
      { id: 'st3', title: '寫初稿', completed: false },
      { id: 'st4', title: '修改潤色', completed: false },
    ],
    notes: '需要包含需求分析和系統架構圖',
  },
  {
    id: 't2',
    title: 'MA5200期中複習',
    courseId: 'c1',
    module: 'campus',
    deadline: '2026-10-21',
    priority: 'high',
    completed: false,
    createdAt: '2026-10-12',
    subTasks: [
      { id: 'st5', title: '複習迴歸分析', completed: false },
      { id: 'st6', title: '做往年題', completed: false },
    ],
  },
  {
    id: 't3',
    title: '整理字節跳動面經到面經庫',
    module: 'job',
    deadline: '2026-10-15',
    priority: 'medium',
    completed: false,
    createdAt: '2026-10-14',
  },
  {
    id: 't4',
    title: '填面試覆盤日記 - 字跳動羣面',
    module: 'job',
    deadline: '2026-10-15',
    priority: 'medium',
    completed: false,
    createdAt: '2026-10-15',
  },
  {
    id: 't5',
    title: '稱重記錄',
    module: 'fitness',
    deadline: '2026-10-15',
    priority: 'low',
    completed: false,
    createdAt: '2026-10-15',
  },
  {
    id: 't6',
    title: '晚餐控制在600大卡',
    module: 'fitness',
    deadline: '2026-10-15',
    priority: 'medium',
    completed: false,
    createdAt: '2026-10-15',
  },
];

// ============ 郵件數據（已改為API實時拉取，mock數據保留備用） ============
export const mockEmails: Email[] = [];

// ============ 找工作數據 ============
export const mockJobs: JobApplication[] = [
  {
    id: 'j1',
    company: '字節跳動',
    position: '運營管培生',
    track: 'mainland',
    status: 'group',
    appliedDate: '2026-09-15',
    deadline: '2026-09-14',
    salaryRange: '18-25k',
    resumeVersion: '運營v2',
    jdLink: 'https://jobs.bytedance.com/xxx',
    referralFrom: '師兄內推',
    interviews: [
      { id: 'i1', jobId: 'j1', type: 'group', scheduledAt: '2026-10-15T09:00:00', location: '線上 - 飛書會議', round: 1, prepared: true },
    ],
  },
  {
    id: 'j2',
    company: '騰訊',
    position: '市場策劃',
    track: 'mainland',
    status: 'business',
    appliedDate: '2026-09-20',
    salaryRange: '15-22k',
    resumeVersion: '市場v1',
    interviews: [
      { id: 'i2', jobId: 'j2', type: 'business', scheduledAt: '2026-10-17T14:00:00', location: '線上 - 騰訊會議', round: 1, prepared: false },
    ],
  },
  {
    id: 'j3',
    company: '美團',
    position: '用户運營',
    track: 'mainland',
    status: 'applied',
    appliedDate: '2026-10-01',
    salaryRange: '14-20k',
    resumeVersion: '運營v2',
  },
  {
    id: 'j4',
    company: "L'Oréal HK",
    position: 'Marketing Trainee',
    track: 'hk',
    status: 'test',
    appliedDate: '2026-10-05',
    salaryRange: '20-25k HKD',
    resumeVersion: 'Marketing EN v1',
  },
  {
    id: 'j5',
    company: '網易',
    position: '內容運營',
    track: 'mainland',
    status: 'rejected',
    appliedDate: '2026-09-10',
    salaryRange: '13-18k',
    resumeVersion: '運營v1',
  },
];

// ============ 面試覆盤數據 ============
export const mockReviews: InterviewReview[] = [
  {
    id: 'r1',
    jobId: 'j1',
    interviewType: '筆試',
    date: '2026-09-28',
    questions: '行測題+運營案例分析：如何為一個新App設計冷啓動方案',
    myAnswers: '從目標用户定位、渠道選擇、內容策略三方面回答',
    goodPoints: '框架清晰，案例分析有邏輯',
    stuckPoints: '冷啓動的具體數據指標説不太清楚',
    improvements: '整理常用運營指標（CAC、LTV、DAU/MAU）',
    mood: 'okay',
  },
];

// ============ 飲食記錄數據 ============
export const mockMeals: MealRecord[] = [
  {
    id: 'm1',
    type: 'breakfast',
    time: '08:30',
    recognizedItems: ['雞蛋', '吐司', '牛奶'],
    date: '2026-10-15',
  },
  {
    id: 'm2',
    type: 'lunch',
    time: '12:30',
    recognizedItems: ['餃子', '牛排', '西蘭花'],
    date: '2026-10-15',
  },
  {
    id: 'm3',
    type: 'snack',
    time: '16:00',
    manualItems: ['蘋果一個'],
    date: '2026-10-15',
  },
];

// ============ 運動記錄數據 ============
export const mockExercises: ExerciseRecord[] = [
  {
    id: 'ex1',
    category: '快走',
    duration: 35,
    time: '17:00',
    date: '2026-10-15',
  },
  {
    id: 'ex2',
    category: '跳繩',
    duration: 20,
    time: '18:00',
    date: '2026-10-13',
  },
];

// ============ 體重記錄數據 ============
export const mockWeights: WeightRecord[] = [
  { id: 'w1', weight: 73.2, date: '2026-10-01' },
  { id: 'w2', weight: 73.0, date: '2026-10-08' },
  { id: 'w3', weight: 72.8, date: '2026-10-15', note: '本週稱重' },
];

// ============ 今日時間軸事件 ============
export const mockTodayEvents: TimelineEvent[] = [
  {
    id: 'te1',
    title: '字節跳動·運營羣面',
    startTime: '09:00',
    endTime: '11:00',
    module: 'job',
    type: 'interview',
    location: '線上 - 飛書會議',
    detail: '第1輪羣面',
    urgent: true,
  },
  {
    id: 'te2',
    title: 'MA5200 數據分析',
    startTime: '14:00',
    endTime: '15:30',
    module: 'campus',
    type: 'course',
    location: 'AC2-3501',
    detail: '李教授',
    urgent: true,
  },
  {
    id: 'te3',
    title: '快走·35分鐘',
    startTime: '17:00',
    endTime: '17:35',
    module: 'fitness',
    type: 'exercise',
    detail: '今日運動',
  },
  {
    id: 'te4',
    title: 'COMP5001 軟件工程',
    startTime: '20:00',
    endTime: '22:00',
    module: 'campus',
    type: 'course',
    location: 'AC1-4502',
    detail: '王教授',
    urgent: true,
  },
];

// ============ 統計數據 ============
export const mockStats = {
  jobProgress: {
    applied: 23,
    inProgress: 12,
    offer: 0,
    rejected: 3,
  },
  weeklyExerciseCount: 3,
  weeklyExerciseMinutes: 95,
  weightGoal: 68,
  currentWeight: 72.8,
  lastWeight: 73.0,
};
