import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { google } from "googleapis";

dotenv.config();

const app = express();

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
      console.log("🔑 Access Token:", accessToken);
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

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email", "https://www.googleapis.com/auth/drive.readonly"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req: Request, res: Response) => {
    if (req.user && "accessToken" in req.user) {
      req.session.accessToken = (req.user as { accessToken: string }).accessToken;
    } else {
      console.error("Access Token not found in user session");
    }
    res.redirect("/profile");
  }
);

app.get("/profile", (req: Request, res: Response) => {
  if (!req.user || !req.user.profile) {
    return res.redirect("/");
  }
  res.send(`Welcome ${req.user.profile.displayName}`);
});

app.get("/drive/files", async (req: Request, res: Response): Promise<any> => {
    try {
      const accessToken = req.session.accessToken;
      if (!accessToken) {
        return res.status(401).json({ error: "Unauthorized. Please login with Google." });
      }
  
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
  
      const drive = google.drive({ version: "v3", auth });
  
      const response = await drive.files.list({
        q: "mimeType='text/plain' or mimeType='text/markdown'",
        pageSize: 10,
        fields: "files(id, name, mimeType)",
      });
  
      const files = response.data.files?.map((file) => ({
        title: file.name,
        link: `https://drive.google.com/file/d/${file.id}/view`,
      })) || [];
  
      res.json(files);
    } catch (error) {
      console.error("Error fetching Drive files:", error);
      res.status(500).json({ error: "Failed to fetch files from Google Drive" });
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
