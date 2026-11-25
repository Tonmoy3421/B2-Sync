import type { EventKind } from "./types";

/**
 * Static reference data from AIUB's official site. Kept in the repo so the
 * app works without scraping or a third-party API at runtime.
 */
export const AIUB_CURRICULUM_URL =
  "https://www.aiub.edu/faculties/fst/programs/under-graduate/bachelor-of-science-in-computer-science--engineering";
export const AIUB_CALENDAR_URL = "https://www.aiub.edu/academic-calendar";

export interface AiubCourse {
  code: string;
  name: string;
  semester: string;
  credits: string;
  area: string;
}

type Row = readonly [code: string, name: string, credits: string];

const CORE: Record<string, Row[]> = {
  "1st semester": [
    ["MAT1102", "Differential Calculus & Coordinate Geometry", "3"],
    ["PHY1101", "Physics 1", "3"],
    ["PHY1102", "Physics 1 Lab", "1"],
    ["ENG1101", "English Reading Skills & Public Speaking", "3"],
    ["CSC1101", "Introduction to Computer Studies", "1"],
    ["CSC1103", "Introduction to Programming Lab", "1"],
    ["CSC1102", "Introduction to Programming", "3"],
  ],
  "2nd semester": [
    ["CSC1204", "Discrete Mathematics", "3"],
    ["MAT1205", "Integral Calculus & Ordinary Differential Equations", "3"],
    ["CSC1205", "Object Oriented Programming 1", "3/Lab"],
    ["PHY1203", "Physics 2", "3"],
    ["PHY1204", "Physics 2 Lab", "1"],
    ["ENG1202", "English Writing Skills & Communications", "3"],
    ["COE2101", "Introduction to Electrical Circuits", "3"],
    ["COE2102", "Introduction to Electrical Circuits Lab", "1"],
  ],
  "3rd semester": [
    ["CHEM1101", "Chemistry", "3"],
    ["MAT2101", "Complex Variable, Laplace & Z-Transformation", "3"],
    ["CSC2108", "Introduction to Database", "3/Lab"],
    ["EEE2104", "Electronic Devices Lab", "1"],
    ["BBA1102", "Principles of Accounting", "3"],
    ["EEE2103", "Electronic Devices", "3"],
    ["CSC2106", "Data Structure", "3"],
    ["CSC2107", "Data Structure Lab", "1"],
    ["BAE2101", "Computer Aided Design & Drafting", "1"],
  ],
  "4th semester": [
    ["CSC2211", "Algorithms", "3/Lab"],
    ["MAT2202", "Matrices, Vectors, Fourier Analysis", "3"],
    ["CSC2210", "Object Oriented Programming 2", "3/Lab"],
    ["CSC2209", "Object Oriented Analysis and Design", "3"],
    ["BAS2101", "Bangladesh Studies", "3"],
    ["EEE3101", "Digital Logic and Circuits", "3"],
    ["EEE3102", "Digital Logic and Circuits Lab", "1"],
    ["MAT3103", "Computational Statistics and Probability", "3"],
  ],
  "5th semester": [
    ["CSC3113", "Theory of Computation", "3"],
    ["ECO3150", "Principles of Economics", "2"],
    ["ENG2103", "Business Communication", "3"],
    ["MAT3101", "Numerical Methods for Science and Engineering", "3"],
    ["COE3103", "Data Communication", "3/Lab"],
    ["COE3104", "Microprocessor and Embedded Systems", "3"],
    ["CSC3112", "Software Engineering", "3/Lab"],
  ],
  "6th semester": [
    ["CSC3217", "Artificial Intelligence and Expert System", "3/Lab"],
    ["COE3206", "Computer Networks", "3/Lab"],
    ["COE3205", "Computer Organization and Architecture", "3/Lab"],
    ["CSC3214", "Operating System", "3/Lab"],
    ["CSC3215", "Web Technologies", "3/Lab"],
    ["EEE2216", "Engineering Ethics", "2"],
    ["CSC3216", "Compiler Design", "3/Lab"],
  ],
  "7th semester": [
    ["CSC4118", "Computer Graphics", "3/Lab"],
    ["MGT3202", "Engineering Management", "3"],
    ["CSC4197", "Research Methodology", "3"],
  ],
  "8th semester": [
    ["CSC4298", "Thesis / Project", "3"],
    ["CSC4299", "Internship", "3"],
  ],
};

const MAJORS: Record<string, Row[]> = {
  "Information Systems": [
    ["CSC4181", "Advanced Database Management System", "3/Lab"],
    ["MIS3101", "Management Information System", "3"],
    ["MIS4011", "Enterprise Resource Planning", "3"],
    ["CSC4285", "Data Warehouse and Data Mining", "3"],
    ["CSC4182", "Human Computer Interaction", "3"],
    ["MIS4014", "Business Intelligence and Decision Support Systems", "3"],
    ["CSC4180", "Introduction to Data Science", "3"],
    ["CSC4183", "Cyber Laws & Information Security", "3"],
    ["MIS4007", "Digital Marketing", "3"],
    ["MIS4012", "E-Commerce, E-Governance & E-Services", "3"],
  ],
  "Software Engineering": [
    ["CSC4270", "Software Development Project Management", "3"],
    ["CSC4160", "Software Requirement Engineering", "3"],
    ["CSC4271", "Software Quality and Testing", "3"],
    ["CSC4162", "Programming in Python", "3/Lab"],
    ["CSC4274", "Virtual Reality Systems Design", "3"],
    ["CSC4163", "Advanced Programming with Java", "3/Lab"],
    ["CSC4164", "Advanced Programming with .NET", "3/Lab"],
    ["CSC4161", "Advanced Programming in Web Technology", "3/Lab"],
    ["CSC4272", "Mobile Application Development", "3/Lab"],
    ["CSC4273", "Software Architecture and Design Patterns", "3"],
  ],
  "Computational Theory": [
    ["CSC4125", "Computer Science Mathematics", "3"],
    ["CSC4126", "Basic Graph Theory", "3"],
    ["CSC4127", "Advanced Algorithm Techniques", "3/Lab"],
    ["CSC4233", "Natural Language Processing", "3"],
    ["CSC4128", "Linear Programming", "3/Lab"],
    ["CSC4231", "Parallel Computing", "3"],
    ["CSC4232", "Machine Learning", "3"],
  ],
  "Computer Engineering": [
    ["BAE1201", "Basic Mechanical Engineering", "3"],
    ["EEE3103", "Digital Signal Processing", "3"],
    ["EEE4217", "VLSI Circuit Design", "3"],
    ["EEE2213", "Signals & Linear System", "3"],
    ["COE4128", "Digital System Design", "3"],
    ["COE4231", "Image Processing", "3"],
    ["COE4129", "Multimedia Systems", "3"],
    ["COE4230", "Simulation and Modeling", "3/Lab"],
    ["COE4126", "Advanced Computer Networks", "3/Lab"],
    ["COE4234", "Computer Vision and Pattern Recognition", "3"],
    ["COE4232", "Network Security", "3"],
    ["COE4125", "Advanced Operating System", "3/Lab"],
    ["EEE4233", "Digital Design with Verilog, VHDL & FPGAs", "3"],
    ["COE4235", "Robotics Engineering", "3"],
    ["EEE4209", "Telecommunications Engineering", "3"],
    ["COE4127", "Network Resource Management & Organization", "3"],
    ["COE4233", "Wireless Sensor Networks", "3/Lab"],
    ["EEE4241", "Industrial Electronics, Drives & Instrumentation", "3/Lab"],
  ],
};

export const AIUB_CSE_COURSES: AiubCourse[] = [
  ...Object.entries(CORE).flatMap(([semester, rows]) =>
    rows.map(([code, name, credits]) => ({ code, name, semester, credits, area: "BSc CSE core" }))
  ),
  ...Object.entries(MAJORS).flatMap(([major, rows]) =>
    rows.map(([code, name, credits]) => ({ code, name, semester: "Other", credits, area: `Major: ${major}` }))
  ),
];

export interface AiubCalendarEvent {
  date: string;
  endDate?: string;
  title: string;
  kind: EventKind;
  description?: string;
}

export type AiubCalendarKey = "cse" | "pharmallb";

export const AIUB_CALENDARS: Record<
  AiubCalendarKey,
  { label: string; term: string; note: string; events: AiubCalendarEvent[] }
> = {
  cse: {
    label: "CSE / general",
    term: "Fall 2026-27",
    note: "Except B.Pharm. & LL.B — matches the CSE curriculum calendar.",
    events: [
      { date: "2026-09-26", title: "Freshman Students' Orientation", kind: "reminder", description: "Specific schedule will be published by AIUB." },
      { date: "2026-09-27", endDate: "2026-10-03", title: "First Day of Classes", kind: "class", description: "Week 1 of Fall 2026-27." },
      { date: "2026-09-29", title: "Last date for registration payment & validation", kind: "assignment" },
      { date: "2026-10-01", title: "Adding / Dropping begins", kind: "reminder", description: "Also on Oct 4. Specific notice will be published." },
      { date: "2026-10-04", title: "Registration closed for Fall 2026-27", kind: "reminder" },
      { date: "2026-10-08", title: "Submission of TSF and course description", kind: "assignment" },
      { date: "2026-10-17", title: "Uncomplete grades of Summer 2025-26 convert to F", kind: "reminder", description: "Applies to UW, I and blank grades." },
      { date: "2026-10-20", endDate: "2026-10-21", title: "Durga Puja holidays", kind: "reminder", description: "Government holiday." },
      { date: "2026-10-31", title: "Last date of 2nd instalment of registration payment", kind: "assignment", description: "3-instalment scheme." },
      { date: "2026-11-01", endDate: "2026-11-07", title: "Laboratory midterm exams", kind: "exam", description: "Midterm permit collection this week." },
      { date: "2026-11-08", endDate: "2026-11-15", title: "Midterm exam", kind: "exam", description: "Specific schedule will be published." },
      { date: "2026-11-15", title: "TPE begins", kind: "reminder" },
      { date: "2026-11-22", title: "Deadline for submitting midterm grades", kind: "assignment" },
      { date: "2026-11-28", title: "Midterm grades locked", kind: "reminder" },
      { date: "2026-11-29", endDate: "2026-12-05", title: "Pre-registration for Spring 2026-27", kind: "reminder" },
      { date: "2026-12-06", title: "No classes (Sunday)", kind: "reminder" },
      { date: "2026-12-12", title: "Makeup for Sunday classes (online)", kind: "class" },
      { date: "2026-12-16", title: "Victory Day holiday", kind: "reminder", description: "Government holiday." },
      { date: "2026-12-17", title: "Deadline for last instalment of registration payment", kind: "assignment" },
      { date: "2026-12-20", endDate: "2026-12-26", title: "Laboratory final exams & final permit collection", kind: "exam" },
      { date: "2026-12-25", title: "Christmas holiday", kind: "reminder", description: "Government holiday." },
      { date: "2026-12-27", endDate: "2027-01-03", title: "Final exam", kind: "exam", description: "Specific schedule will be published." },
      { date: "2027-01-10", title: "Deadline for final grade submission & Set B exams", kind: "assignment" },
      { date: "2027-01-16", title: "Final grades locked", kind: "reminder" },
      { date: "2027-01-24", title: "First day of classes for Spring 2026-27", kind: "class" },
      { date: "2027-02-11", title: "UW / I grades of this semester convert to F", kind: "reminder" },
    ],
  },
  pharmallb: {
    label: "B.Pharm. & LL.B",
    term: "Fall 2026-27",
    note: "Separate calendar for B.Pharm. and LL.B programs.",
    events: [
      { date: "2026-07-14", title: "Last date for registration payment & validation", kind: "assignment" },
      { date: "2026-07-16", title: "Adding / Dropping", kind: "reminder", description: "Also on Jul 18." },
      { date: "2026-07-18", title: "Freshman Students' Orientation", kind: "reminder" },
      { date: "2026-07-19", endDate: "2026-07-25", title: "First Day of Classes", kind: "class", description: "Week 1 of Fall 2026-27." },
      { date: "2026-07-27", title: "Registration closed for Fall 2026-27", kind: "reminder" },
      { date: "2026-08-04", title: "Submission of TSF and course description", kind: "assignment" },
      { date: "2026-08-25", title: "Last date of 2nd instalment of registration payment", kind: "assignment", description: "3-instalment scheme." },
      { date: "2026-09-06", endDate: "2026-09-12", title: "Permit collection & laboratory midterm exams", kind: "exam" },
      { date: "2026-09-12", title: "Deadline for submitting midterm grades", kind: "assignment" },
      { date: "2026-09-13", endDate: "2026-09-19", title: "Midterm exam & Set B exams / viva voce", kind: "exam" },
      { date: "2026-09-20", endDate: "2026-09-26", title: "TPE", kind: "reminder" },
      { date: "2026-09-30", title: "Midterm grades locked", kind: "reminder" },
      { date: "2026-10-04", endDate: "2026-10-10", title: "Pre-registration for Spring 2026-27", kind: "reminder" },
      { date: "2026-10-27", title: "Deadline for last instalment of registration payment", kind: "assignment" },
      { date: "2026-11-08", endDate: "2026-11-14", title: "Laboratory final exams & permit collection", kind: "exam" },
      { date: "2026-11-15", endDate: "2026-11-21", title: "Final exam & Set B exams / viva voce", kind: "exam" },
      { date: "2026-11-27", title: "Deadline for final grade submission", kind: "assignment" },
      { date: "2026-12-05", title: "Final grades locked", kind: "reminder" },
      { date: "2026-12-17", title: "UW / I grades of this semester convert to F", kind: "reminder" },
    ],
  },
};

/** 09:00 Dhaka time for a YYYY-MM-DD date (the calendar's all-day slot). */
export function aiubEventIso(date: string, endOfDay = false) {
  return new Date(`${date}T${endOfDay ? "23:59" : "09:00"}:00+06:00`).toISOString();
}
