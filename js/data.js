/* GymBro - simulated data.
   Nothing here comes from a real sensor or server. Occupancy is computed as
   people currently checked in / zone capacity, using invented numbers chosen
   so the first render matches the Figma mockup (92%, 64%, 28%, ...).
   Loaded with <script src> so the prototype also works when opened as a file. */

window.GYM_DATA = {
  gym: "Campus Gym (UFV)",
  user: {
    name: "Juan",
    initial: "J",
    profile: "3rd year Computer Engineering - Regular & independent gym user"
  },

  /* Thresholds for the colour language: Free < 50% <= Moderate < 80% <= Full */
  thresholds: { moderate: 50, full: 80 },

  /* Order and areas follow the floor plan in "Facilities - Occupancy map" */
  zones: [
    { id: "free-weights", name: "Free Weights", area: "fw",       capacity: 25, people: 23 },
    { id: "cardio",       name: "Cardio Area",  area: "cardio",   capacity: 25, people: 16 },
    { id: "machines",     name: "Machines",     area: "machines", capacity: 25, people: 7 },
    { id: "stretching",   name: "Stretching",   area: "stretch",  capacity: 11, people: 2 },
    { id: "studio",       name: "Studio",       area: "studio",   capacity: 20, people: 11 },
    { id: "boxing",       name: "Boxing Area",  area: "boxing",   capacity: 9,  people: 2 },
    { id: "squat-racks",  name: "Squat Racks",  area: "squat",    capacity: 8,  people: 7 }
  ],

  favourites: [
    { zone: "cardio", img: "cardio", label: "Cardio" },
    { zone: "free-weights", img: "weights", label: "Free Weights" }
  ],

  plannedWorkout: { title: "Bench Press", partner: "Carlos", chat: "carlos", time: "14:30" },

  filters: ["Wednesday", "14:00-16:00", "Hypertrophy", "Intermediate"],

  matches: [
    { id: "jason", name: "Jason", score: 92, reason: "Shares Wednesday 14:00 slot & goal is Hypertrophy.", tags: ["Intermediate", "Free weights"] },
    { id: "lucia", name: "Lucía", score: 88, reason: "Trains Wednesday afternoons & follows a strength split.", tags: ["Intermediate", "Strength"] },
    { id: "marco", name: "Marco", score: 81, reason: "Available 14:00-16:00 & looking for a consistent spotter.", tags: ["Advanced", "Hypertrophy"] }
  ],

  chats: [
    { id: "jason", name: "Jason", when: "14:32", unread: 2, photo: true,
      messages: [
        { from: "them", text: "Hello Juan!", time: "14:20" },
        { from: "me", text: "Hi Jason!", time: "14:21" },
        { from: "them", text: "We both train Wednesday at 14:00. Want to team up?", time: "14:22" },
        { from: "me", text: "Sure! I'm focusing on hypertrophy this block.", time: "14:25" },
        { from: "them", text: "Perfect, let's plan a session.", time: "14:32" }
      ] },
    { id: "lucia", name: "Lucía", when: "Yesterday", unread: 0, photo: true,
      messages: [ { from: "them", text: "Sounds good, see you at Free Weights.", time: "19:05" } ] },
    { id: "marco", name: "Marco", when: "Yesterday", unread: 1, photo: true,
      messages: [ { from: "them", text: "Are you free Thursday at 14:00?", time: "18:40" } ] },
    { id: "carlos", name: "Carlos", when: "Mon", unread: 0, photo: false,
      messages: [ { from: "them", text: "Bench Press session was great!", time: "16:10" } ] },
    { id: "sofia", name: "Sofía", when: "Sun", unread: 0, photo: false,
      messages: [ { from: "them", text: "Thanks for the spot today", time: "12:02" } ] }
  ],

  workouts: ["Chest & Triceps", "Back & Biceps", "Legs", "Shoulders", "Full body", "Cardio"],
  gymHours: { open: "07:00", close: "22:00" }
};
