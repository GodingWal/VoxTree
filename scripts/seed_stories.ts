
import { storage } from "../server/storage";

async function seed() {
    console.log("Seeding stories...");

    const stories = [
        {
            title: "The Little Astronaut",
            slug: "the-little-astronaut",
            category: "ADVENTURE",
            summary: "Join Leo on his first journey to the moon!",
            ageMin: 3,
            ageMax: 6,
            durationMin: 2,
            tags: ["space", "dreams", "courage"],
            rights: "ORIGINAL",
            sections: [
                {
                    index: 0,
                    text: "Leo looked up at the big, bright moon. 'I want to go there!' he said. He put on his shiny silver helmet and climbed into his cardboard rocket. 3, 2, 1, Blast off! The rocket zoomed past the stars. When he landed, he met a friendly moon alien named Zip. 'Welcome to the moon!' said Zip. 'Let's play hide and seek!'"
                }
            ]
        },
        {
            title: "The Sleepy Bear",
            slug: "the-sleepy-bear",
            category: "BEDTIME",
            summary: "A cozy tale about a bear getting ready for hibernation.",
            ageMin: 2,
            ageMax: 5,
            durationMin: 3,
            tags: ["animals", "sleep", "winter"],
            rights: "ORIGINAL",
            sections: [
                {
                    index: 0,
                    text: "The leaves were falling, and the air was getting chilly. Barnaby Bear yawned a big, wide yawn. 'I am so sleepy,' he said. He fluffed his pillow made of soft moss. His friends the squirrels brought him some nuts for a snack. 'Goodnight, Barnaby!' they whispered. 'See you in the spring.'"
                }
            ]
        },
        {
            title: "The Magic Garden",
            slug: "the-magic-garden",
            category: "FAIRYTALE",
            summary: "Lily discovers a garden where flowers can sing.",
            ageMin: 4,
            ageMax: 8,
            durationMin: 4,
            tags: ["magic", "nature", "music"],
            rights: "ORIGINAL",
            sections: [
                {
                    index: 0,
                    text: "Lily found a tiny golden key under a mushroom. She opened the old wooden gate at the back of her yard. Inside, the roses were humming a sweet melody. The daisies were dancing in the breeze. 'Hello, Lily!' sang a big sunflower. 'Will you sing with us?'"
                }
            ]
        },
        {
            title: "The Brave Little Turtle",
            slug: "the-brave-little-turtle",
            category: "CLASSIC",
            summary: "A shy turtle learns that being yourself is the greatest strength of all.",
            ageMin: 4,
            ageMax: 8,
            durationMin: 5,
            tags: ["courage", "friendship", "self-acceptance"],
            rights: "ORIGINAL",
            sections: [
                {
                    index: 0,
                    text: "Timothy the turtle was very shy. Whenever the other animals ran and leaped through the meadow, he hid inside his shell. 'Come out and play!' called the rabbits. But Timothy just peeked through a tiny crack. One day, a heavy rainstorm flooded the meadow. The rabbits and foxes didn't know what to do."
                },
                {
                    index: 1,
                    text: "Timothy slowly crawled out of his shell. 'Follow me!' he said in a small but steady voice. He knew every safe path in the meadow because he had always watched carefully from inside his shell. He led all his friends to dry ground. From that day on, Timothy wasn't quite so shy. He had learned that being careful and observant was its own kind of bravery."
                }
            ]
        },
        {
            title: "Counting Stars",
            slug: "counting-stars",
            category: "EDUCATIONAL",
            summary: "A little girl and her grandpa count the stars and learn about the universe.",
            ageMin: 3,
            ageMax: 6,
            durationMin: 3,
            tags: ["numbers", "space", "family", "learning"],
            rights: "ORIGINAL",
            sections: [
                {
                    index: 0,
                    text: "Every night, Mia and Grandpa sat on the porch and looked up at the sky. 'How many stars are there, Grandpa?' Mia asked. 'More than we can count!' he said. They started together. 'One, two, three, four, five...' Mia pointed to each tiny light. 'Ten! I see ten stars in that group, Grandpa!' The group was called the Big Dipper, and it had exactly seven stars — but Mia counted the extra bright ones too. 'You are very good at counting,' smiled Grandpa. 'Now let's count to twenty, one star at a time.'"
                }
            ]
        },
        {
            title: "The Dragon Who Lost His Fire",
            slug: "the-dragon-who-lost-his-fire",
            category: "FAIRYTALE",
            summary: "A young dragon discovers that warmth comes from the heart, not the flames.",
            ageMin: 5,
            ageMax: 9,
            durationMin: 6,
            tags: ["dragons", "kindness", "magic", "friendship"],
            rights: "ORIGINAL",
            sections: [
                {
                    index: 0,
                    text: "Ember the dragon woke up one morning and couldn't breathe fire. No matter how hard he tried, only tiny puffs of smoke came out. 'How will I keep warm? How will I toast marshmallows?' he worried. He set off through the Whispering Wood to find the Wise Owl. Along the way, he saw a family of hedgehogs shivering in the cold. Even without fire, Ember spread his big wings over them to block the icy wind."
                },
                {
                    index: 1,
                    text: "Next, he found a lost fox kit crying in the dark. Ember couldn't light the path with fire, but he knew the way by heart and gently guided the little fox home. When Ember finally reached the Wise Owl, something magical happened — a warm golden glow spread from his chest. 'Your fire was never lost,' said the Owl wisely. 'It was simply waiting inside your heart, growing stronger with every act of kindness.' From that day on, Ember's fire burned brighter than ever before."
                }
            ]
        },
        {
            title: "Bedtime on the Farm",
            slug: "bedtime-on-the-farm",
            category: "BEDTIME",
            summary: "As the sun sets, all the farm animals settle in for a peaceful night's rest.",
            ageMin: 2,
            ageMax: 5,
            durationMin: 3,
            tags: ["animals", "farm", "bedtime", "night"],
            rights: "ORIGINAL",
            sections: [
                {
                    index: 0,
                    text: "The big orange sun dipped behind the hills, and the whole farm grew quiet. The chickens tucked their heads under their wings — one, two, three little chickens, fast asleep. The spotted cow lay down in the soft hay and let out one long, sleepy moo. The little lamb curled up next to her mama, warm and safe. Even the rooster was too tired to crow. Farmer Jo walked through the barn one last time, whispering goodnight to everyone. The stars came out, one by one. It was time for everyone on the farm — and for you — to close their eyes and dream."
                }
            ]
        },
        {
            title: "The Rainbow Bridge",
            slug: "the-rainbow-bridge",
            category: "ADVENTURE",
            summary: "Two friends from opposite sides of a valley build a bridge of colors together.",
            ageMin: 4,
            ageMax: 8,
            durationMin: 5,
            tags: ["friendship", "teamwork", "colors", "adventure"],
            rights: "ORIGINAL",
            sections: [
                {
                    index: 0,
                    text: "On one side of the valley lived Asha, who loved the color red. On the other side lived Bo, who loved the color blue. The valley between them was wide and wild, full of rushing rivers and tall trees. They had always waved at each other from across the valley, but they had never met. One morning, a great storm split the old wooden bridge in half. 'Now we can never cross,' said Asha sadly."
                },
                {
                    index: 1,
                    text: "But then Asha had an idea. She wove a long rope from red vines. Bo had the same idea — he made a rope from blue reeds. They threw their ropes to each other across the narrowest part of the valley. Together, they braided them into a single, strong bridge, striped red and blue. When they finally crossed and met in the middle, they looked down at their beautiful bridge. Where the red and blue twisted together, a new color glowed — purple! 'I never knew,' laughed Asha. 'Two things together can make something completely new,' said Bo. And their friendship was the brightest color of all."
                }
            ]
        }
    ];

    // Try to find a user to assign stories to
    let userId: string | undefined;

    // Try finding the user from logs
    const user = await storage.getUserByEmail("gwal325@gmail.com");
    userId = user?.id;

    if (!userId) {
        console.log("User gwal325@gmail.com not found. Creating system user...");
        try {
            // Check if system user exists first
            const sysUser = await storage.getUserByEmail("system@voxtree.com");
            if (sysUser) {
                userId = sysUser.id;
            } else {
                const newUser = await storage.createUser({
                    username: "system_story_seeder",
                    email: "system@voxtree.com",
                    password: "hashed_password_placeholder",
                    role: "admin"
                });
                userId = newUser.id;
            }
        } catch (e) {
            console.error("Error getting/creating system user:", e);
        }
    }

    if (!userId) {
        console.error("No user found to assign stories to. Aborting.");
        process.exit(1);
    }

    for (const s of stories) {
        console.log(`Processing story: ${s.title}`);

        const existing = await storage.getStoryBySlug(s.slug);
        let storyId = existing?.id;

        if (!existing) {
            const newStory = await storage.createStory({
                title: s.title,
                slug: s.slug,
                category: s.category as any,
                summary: s.summary,
                ageMin: s.ageMin,
                ageMax: s.ageMax,
                durationMin: s.durationMin,
                tags: s.tags,
                rights: s.rights as any,
                createdBy: userId,
                isPublic: true,
                coverUrl: `https://placehold.co/600x400?text=${encodeURIComponent(s.title)}`,
                content: s.sections.map(sec => sec.text).join("\n\n"),
                metadata: {}
            });
            storyId = newStory.id;
            console.log(`Created new story with ID: ${storyId}`);
        } else {
            console.log(`Story ${s.slug} already exists.`);
        }

        if (storyId) {
            const sections = s.sections.map(sec => ({
                storyId: storyId!,
                sectionIndex: sec.index,
                text: sec.text,
                wordCount: sec.text.split(" ").length,
                durationEst: sec.text.length * 0.1
            }));
            await storage.replaceStorySections(storyId, sections);
            console.log(`Updated ${sections.length} sections for ${s.title}`);
        }
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
