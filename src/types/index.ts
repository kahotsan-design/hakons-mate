// ============ 通用類型 ============
export type ModuleType = 'campus' | 'job' | 'fitness' | 'work';

// ============ 課程相關 ============
export interface Course {
  id: string;
  name: string;           // 課程名
  code: string;           // 課程代碼 e.g. COMP5001
  teacher: string;        // 老師名
  teacherEmail?: string;  // 老師郵箱
  location: string;       // 教室
  dayOfWeek: number;      // 0=週日, 1-6=週一至週六
  startTime: string;      // "14:00"
  endTime: string;        // "15:30"
  weeks: number[];        // 上課的周次 [1,2,3,...,13]
  credits: number;        // 學分
  color: string;          // 課程顏色標識
  canvasLink?: string;    // Canvas鏈接
  officeHour?: string;    // Office Hour時間
  gradeComposition?: string; // 平時分構成
}

// ============ 任務相關 ============
export interface Task {
  id: string;
  title: string;          // 任務標題
  courseId?: string;      // 關聯課程（學校任務）
  module: ModuleType;     // 來源模塊
  date?: string;          // 任務所屬日期 YYYY-MM-DD（按天管理）
  rolledFrom?: string;    // 順延來源日期（未完成任務自動順延到今天時記錄）
  deadline?: string;      // ISO日期（截止日）
  startDate?: string;     // 起始日 YYYY-MM-DD（「从X做到Y」的时间范围，可选）
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  completedAt?: string;
  subTasks?: SubTask[];   // 子任務
  notes?: string;
  createdAt: string;
  company?: string;       // 工作任務所屬公司
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

// ============ 郵件相關 ============
export interface Email {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;        // 預覽文本
  date: string;           // 郵件日期
  receivedAt: string;     // ISO日期
  category: 'course' | 'announcement' | 'activity' | 'other';
  read: boolean;
  starred: boolean;
  link?: string;          // 跳轉163原文鏈接
}

// ============ 找工作相關 ============
export type JobStatus =
  | 'todo'          // 待網申
  | 'applied'       // 已投遞
  | 'test'          // 筆試
  | 'group'         // 羣面
  | 'business'      // 業務面
  | 'hr'            // HR面
  | 'offer'         // offer
  | 'rejected';     // 拒絕

export type JobTrack = 'mainland' | 'hk';  // 內地秋招 / 留港備選

// 簡化版秋招記錄
export interface JobRecord {
  id: string;
  company: string;                          // 公司
  position: string;                         // 崗位
  date: string;                             // 時間（投遞/面試）
  writtenTest: 'none' | 'pass' | 'fail';    // 筆試：未考/過了/沒過
  stage: 'applied' | 'written' | 'r1' | 'r2' | 'r3' | 'hr' | 'offer' | 'ended'; // 當前輪次
  result: 'ongoing' | 'pass' | 'fail';      // 結果：進行中/過了/沒過
  notes?: string;
}

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  track: JobTrack;
  status: JobStatus;
  appliedDate?: string;
  deadline?: string;       // 網申DDL
  salaryRange?: string;
  resumeVersion?: string;  // 用的簡歷版本
  jdLink?: string;
  referralFrom?: string;   // 內推來源
  notes?: string;
  interviews?: Interview[];
}

export interface Interview {
  id: string;
  jobId: string;
  type: 'test' | 'group' | 'business' | 'hr';
  scheduledAt: string;     // ISO日期時間
  location?: string;       // 線上鏈接或線下地點
  round: number;           // 第幾輪
  prepared: boolean;       // 是否完成準備
}

export interface InterviewReview {
  id: string;
  jobId: string;
  interviewType: string;
  date: string;
  questions: string;       // 被問了什麼
  myAnswers: string;       // 怎麼答的
  goodPoints: string;      // 答得好的
  stuckPoints: string;     // 卡殼點
  improvements: string;    // 下次怎麼改
  mood: 'confident' | 'okay' | 'frustrated';
}

// ============ 減肥相關 ============
export interface MealRecord {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  time: string;            // "08:30"
  photo?: string;          // 圖片URL（base64或路徑）
  recognizedItems?: string[]; // AI識別的食材
  manualItems?: string[];  // 手動添加的
  notes?: string;
  date: string;            // YYYY-MM-DD
  calories?: number;       // AI估算總熱量（千卡）
  nutrition?: {            // AI估算營養素
    protein?: number;      // 蛋白質(g)
    fat?: number;          // 脂肪(g)
    carbs?: number;        // 碳水(g)
  };
}

export interface ExerciseRecord {
  id: string;
  category: string;        // 運動類目
  exerciseType?: 'cardio' | 'strength'; // 有氧/無氧
  duration: number;        // 分鐘
  time: string;            // "17:00"
  date: string;            // YYYY-MM-DD
  notes?: string;
}

export interface WeightRecord {
  id: string;
  weight: number;          // kg
  date: string;            // YYYY-MM-DD
  note?: string;
}

// ============ 時間軸事項 ============
export interface TimelineEvent {
  id: string;
  title: string;
  startTime: string;       // "09:00"
  endTime?: string;        // "11:00"
  module: ModuleType;
  type: 'course' | 'interview' | 'exercise' | 'deadline' | 'other';
  location?: string;
  detail?: string;
  urgent?: boolean;        // 是否緊急/衝突
}

// ============ 統一數據狀態 ============
export interface AppState {
  courses: Course[];
  tasks: Task[];
  emails: Email[];
  jobs: JobApplication[];
  reviews: InterviewReview[];
  meals: MealRecord[];
  exercises: ExerciseRecord[];
  weights: WeightRecord[];
}
