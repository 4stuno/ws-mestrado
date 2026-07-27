# Story generation flow

How the tool turns course data into narratives for the instructor.

```mermaid
flowchart TD
  A[1. Instructor runs a query<br/>selects the activity and filters] --> B[2. System receives the parameters<br/>activity, time window, and analysis preferences]
  B --> C[3. Loads course data<br/>access logs, materials, grades, and students]
  C --> D[4. Cuts the activity period<br/>from opening to the submission deadline]
  D --> E[5. Checks whether an analysis is already available]
  E -->|no| F[6. Simplifies the navigation history<br/>removes noise and groups repeated actions]
  F --> G[7. Stores the result for reuse]
  E -->|yes| H[8. Filters the audience<br/>by student, city, or performance profile]
  G --> H
  H --> I[9. Prepares the timeline view<br/>organizes events and measures adherence to the ideal flow]
  I --> J[10. Generates pedagogical stories<br/>detects preparation, bottleneck, rhythm, and interaction patterns]
  J --> K[11. Keeps only what matters<br/>drops patterns that affect few students]
  K --> L[12. Shows the result<br/>stories, timeline, and indicators]
```

## One sentence per step

1. **Query** — the instructor chooses the activity and how to look at the class  
2. **Parameters** — the system understands the scope of the analysis  
3. **Data** — loads the available course history  
4. **Period** — limits the analysis to the activity window  
5. **Reuse** — avoids recomputing what was already processed  
6. **Simplification** — cleans and summarizes student navigation  
7. **Memory** — stores that summary for later queries  
8. **Filter** — focuses on the students or profiles of interest  
9. **Timeline** — organizes the visual path and adherence to the expected flow  
10. **Stories** — turns behavior patterns into narratives for the instructor  
11. **Relevance** — shows only what has enough impact on the class  
12. **Result** — returns stories, timeline, and summary indicators  
