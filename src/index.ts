import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { google } from "googleapis";
import { Pinecone } from "@pinecone-database/pinecone";
import Configuration, {OpenAI} from "openai";
import axios from "axios";
import cors from "cors"

dotenv.config();

const app = express();
app.use(express.json());
app.use(
    cors({
      origin: "http://localhost:5173", 
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"], 
    })
  );

declare module "express-session" {
  interface SessionData {
    passport?: { user?: any };
    accessToken?: string;
  }
}

declare module "express" {
  interface Request {
    user?: any;
    session: {
      accessToken?: string;
    };
  }
}

interface AuthenticatedUser {
  profile: any;
  accessToken: string;
}

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "http://localhost:5000/auth/google/callback",
      scope: ["profile", "email", "https://www.googleapis.com/auth/drive.readonly"],
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, { profile, accessToken });
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  done(null, user);
});

passport.deserializeUser((user: AuthenticatedUser, done) => {
  done(null, user);
});

app.get("/", (req: Request, res: Response) => {
  res.send("<a href='/auth/google'>Login with Google</a>");
});

app.get("/auth/google", passport.authenticate("google"));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/dashboard" }),
  (req: Request, res: Response) => {
    if (req.user && "accessToken" in req.user) {
      req.session.accessToken = (req.user as { accessToken: string }).accessToken;
    }
    res.redirect("http://localhost:5173/dashboard");
  }
);

app.get("/profile", (req: Request, res: Response) => {
    if (!req.user || !req.user.profile) {
        return res.redirect("/");
    }
  res.send(`Welcome ${req.user.profile.displayName}`);
});

// app.post("/ingest", async (req: Request, res: Response): Promise<any> => {
//   try {
//     const accessToken = req.session.accessToken;
//     if (!accessToken) return res.status(401).json({ error: "Unauthorized" });

//     const auth = new google.auth.OAuth2();
//     auth.setCredentials({ access_token: accessToken });

//     const drive = google.drive({ version: "v3", auth });
//     const query = "mimeType='text/plain' or mimeType='text/markdown'";
//     const response = await drive.files.list({ q: query, fields: "files(id, name, webViewLink)" });

//     const files = response.data.files || [];
//     if (files.length === 0) return res.json({ message: "No files to process" });

//     const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);

//     for (const file of files) {
//       try {
//         const fileContentRes = await drive.files.get(
//           { fileId: file.id!, alt: "media" },
//           { responseType: "text" }
//         );

//         const textContent =
//           typeof fileContentRes.data === "string" ? fileContentRes.data : JSON.stringify(fileContentRes.data);

//           const embeddingRes = await openai.embeddings.create({
//             model: "text-embedding-ada-002",
//             input: textContent,
//           });

//           const embedding = embeddingRes.data[0].embedding;
//         if (!embedding) {
//           console.error("Embedding generation failed for file:", file.name);
//           continue;
//         }

//         await pineconeIndex.upsert([
//             {
//               id: file.id!,
//               values: embedding,
//               metadata: {
//                 title: file.name!,
//                 link: file.webViewLink!,
//               },
//             },
//           ]);
//       } catch (fileError) {
//         console.error(`Error processing file ${file.name}:`, fileError);
//       }
//     }

//     res.json({ message: "Files processed successfully" });
//   } catch (error) {
//     console.error("Error in ingestion:", error);
//     res.status(500).json({ error: "Failed to ingest files" });
//   }
// });


app.post("/ingest", async (req: Request, res: Response): Promise<any> => {
    try {
      console.log("🔄 Starting ingestion process...");
  
      // 1️⃣ Check if the user is authenticated
      const accessToken = req.session?.accessToken;
      if (!accessToken) {
        console.error("❌ Unauthorized: No access token.");
        return res.status(401).json({ error: "Unauthorized" });
      }
  
      console.log("✅ Access token found. Authenticating Google Drive...");
  
      // 2️⃣ Authenticate Google Drive
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
  
      const drive = google.drive({ version: "v3", auth });
  
      // 3️⃣ Fetch Google Drive files
      const query = "mimeType='text/plain' or mimeType='text/markdown'";
      const response = await drive.files.list({ q: query, fields: "files(id, name, webViewLink)" });
  
      const files = response.data.files || [];
      console.log(`📂 Retrieved ${files.length} files from Google Drive.`);
  
      if (files.length === 0) {
        return res.json({ message: "No files to process" });
      }
  
    
      const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);


      
      console.log("✅ Pinecone index initialized.");
  
      for (const file of files) {
        try {
          console.log(`🔍 Processing file: ${file.name} (ID: ${file.id})`);
  
          const fileContentRes = await drive.files.get(
            { fileId: file.id!, alt: "media" },
            { responseType: "text" }
          );
  
          let textContent =
            typeof fileContentRes.data === "string" ? fileContentRes.data : JSON.stringify(fileContentRes.data);
  
          if (!textContent.trim()) {
            console.warn(`⚠️ Skipping ${file.name} (empty content).`);
            continue;
          }
  
          console.log(`📄 Extracted text from ${file.name}:`, textContent.slice(0, 100) + "...");
  
         
          const embeddingRes = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: textContent,
          });
  
          if (!embeddingRes.data.length || !embeddingRes.data[0].embedding) {
            console.error(`❌ Embedding generation failed for ${file.name}.`);
            continue;
          }
  
          const embedding = embeddingRes.data[0].embedding;
          console.log(`🧠 Generated embedding for ${file.name}:`, embedding.slice(0, 5), "...");
  
          // 7️⃣ Store embedding in Pinecone
          await pineconeIndex.upsert([
            {
              id: file.id!,
              values: embedding,
              metadata: {
                title: file.name!,
                link: file.webViewLink!,
              },
            },
          ]);
          
  
          console.log(`✅ Successfully stored ${file.name} in Pinecone.`);
        } catch (fileError) {
          console.error(`🚨 Error processing file ${file.name}:`, fileError);
        }
      }
  
      console.log("🎉 All files processed successfully.");
      res.json({ message: "Files processed successfully" });
    } catch (error) {
      console.error("🚨 Error in ingestion:", error);
      res.status(500).json({ error: "Failed to ingest files" });
    }
  });
  

  app.post("/search", async (req: Request, res: Response): Promise<any> => {
    try {
      const { query } = req.body;
  
      if (!query) {
        return res.status(400).json({ error: "Query parameter is required" });
      }
  
      console.log(`🔍 Searching for: ${query}`);
  
      const embeddingRes = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: query,
      });
  
      if (!embeddingRes.data.length || !embeddingRes.data[0].embedding) {
        console.error("❌ Failed to generate embedding for query.");
        return res.status(500).json({ error: "Embedding generation failed" });
      }
  
      const queryEmbedding = embeddingRes.data[0].embedding;
      console.log(`🧠 Query embedding generated.`);
  
     
      const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);
      const searchResults = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true, 
      });
      
  
      if (!searchResults.matches || searchResults.matches.length === 0) {
        console.log("🔎 No relevant results found.");
        return res.json({ message: "No relevant files found" });
      }
  
      // 3️⃣ Extract relevant file metadata
      const results = searchResults.matches.map((match) => ({
        id: match.id,
        title: match.metadata?.title,
        link: match.metadata?.link,
        score: match.score, // Similarity score (optional)
      }));
  
      console.log(`✅ Found ${results.length} matching files.`);
      res.json({ results });
    } catch (error) {
      console.error("🚨 Error in search:", error);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

app.get("/logout", (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
