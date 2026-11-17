# Plan4U — Your Degree, Mapped Out

Plan4U is an interactive academic planning tool designed to help University of British Columbia (UBC) Computer Science students explore courses, understand prerequisite relationships, and plan their degrees more intuitively.

By transforming complex academic requirements into an interactive constellation, Plan4U helps students visualize how courses connect, discover future opportunities, and make more informed academic decisions.

## 🚀 Live Demo

**[Explore Plan4U](https://tokens-depth-42978336.figma.site)**

The interactive prototype is accessible directly through your browser.

## Project Motivation

Planning a university degree can be overwhelming. Students often need to navigate multiple academic resources, interpret complicated prerequisite combinations, and manually determine which courses they are eligible to take.

Plan4U aims to simplify this process by bringing course exploration, prerequisite visualization, degree progress tracking, and academic planning into one unified interface.

## Key Features

### 🌌 Constellation — Interactive Course Exploration

Explore course relationships through a space-inspired, interactive visualization.

- Navigate between courses by selecting individual course nodes.
- Visualize prerequisite and dependent course relationships.
- Identify completed, planned, and available courses through colour-coded nodes.
- Explore missing prerequisites through interactive course information popups.
- Navigate backwards through previously explored courses.
- Pan, zoom, and search for specific courses.

### 🔍 Search & Compare

Discover and compare courses based on academic requirements, personal interests, and course information.

- Search courses by course code, title, or keywords.
- Filter courses by year level and degree requirement categories.
- Compare two courses side by side.
- View course descriptions, historical grade averages, and instructor information.
- Identify prerequisite satisfaction through simplified status indicators.
- Click course codes to explore their relationships in the Constellation interface.

### 🧩 Intelligent Prerequisite Planning

Plan4U considers both completed and planned courses when evaluating prerequisite satisfaction.

Courses are classified into three prerequisite states:

- **Prerequisites satisfied:** Required courses have already been completed.
- **Satisfied with planned courses:** Requirements can be satisfied through the current course plan.
- **Prerequisites incomplete:** Additional courses are required.

Complex prerequisite combinations are simplified into understandable requirement groups, helping students identify what they actually need to complete.

### 📋 Personalized Course Plan

Build and manage a personalized academic plan.

- Record previously completed courses.
- Add and remove future courses.
- Identify which planned courses can be taken immediately.
- Understand which courses depend on other planned courses.
- Identify missing prerequisites before registration.

The course plan is shared across both interfaces, allowing students to switch between exploration and planning seamlessly.

### 📊 Degree Progress

Track academic progress toward graduation.

- Monitor completed and planned credits.
- Visualize progress across degree requirement categories.
- Identify mandatory courses required for graduation.
- Automatically update progress as the course plan changes.

## Constellation Colour System

| Colour | Meaning |
| --- | --- |
| 🟢 Green | Completed course |
| 🟡 Yellow | Planned course |
| 🟣 Purple | Prerequisites satisfied through completed or planned courses |
| 🔵 Blue | Prerequisites incomplete |
| ⭐ Gold star | Mandatory course required for graduation |

Cyan and orange arrows represent prerequisite and dependent course relationships, respectively.

## Design Philosophy

Plan4U is designed around principles of human-computer interaction, with an emphasis on:

- **Visual clarity:** Making complex academic relationships easier to understand through visualization.
- **Progressive disclosure:** Presenting essential information first while allowing students to explore additional details when needed.
- **Consistency:** Maintaining shared interactions, visual indicators, and planning information across both interfaces.
- **User control:** Allowing students to freely explore courses and adjust their academic plans.
- **Reduced cognitive load:** Simplifying complicated prerequisite requirements and minimizing unnecessary information.

The space-inspired design represents courses as interconnected stars, reflecting the different pathways students can take throughout their academic journey.

## Technologies

- **Frontend:** React, TypeScript
- **Build Tool:** Vite
- **Design & Prototyping:** Figma, Figma Make
- **Course Data:** UBC Academic Calendar
- **Historical Course Statistics:** UBCGrades

## Academic Context

Plan4U was developed as an interactive design prototype for **CPSC 344: Human-Computer Interaction** at the University of British Columbia.

The project explores how interactive visualization and user-centred design can improve the academic planning experience for university students.

## Future Opportunities

- Expand support to additional degree programs and universities.
- Introduce semester-by-semester course scheduling.
- Integrate more comprehensive degree requirement validation.
- Provide personalized course recommendations based on academic interests and career goals.

## Disclaimer

Plan4U is an academic planning prototype and is not an official UBC registration or degree auditing system.

Course information, prerequisite requirements, and historical statistics are provided for planning purposes. Students should consult the official UBC Academic Calendar and academic advisors to confirm degree requirements and registration eligibility.
