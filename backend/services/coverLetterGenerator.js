const { GoogleGenerativeAI } = require('@google/generative-ai');

class CoverLetterGenerator {
  constructor() {
    // Check for OpenAI API key first (more reliable)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const OpenAI = require('openai');
      this.openai = new OpenAI({
        apiKey: openaiKey,
      });
      this.useOpenAI = true;
    } else {
      // Fallback to Gemini
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        this.genAI = new GoogleGenerativeAI(geminiKey);
        // Use gemini-1.5-flash which is available
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        this.useOpenAI = false;
      } else {
        this.useOpenAI = false;
        this.model = null;
      }
    }
  }

  async generateCoverLetter(userProfile, jobDescription) {
    try {
      const prompt = this.buildPrompt(userProfile, jobDescription);

      if (this.useOpenAI) {
        // Use OpenAI API
        const completion = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a professional cover letter writer. Create compelling, personalized cover letters that highlight the candidate's relevant skills and experience for the specific job. Keep the tone professional yet engaging, and ensure the letter is concise (200-300 words)."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
        });

        const coverLetter = completion.choices[0].message.content.trim();
        return coverLetter;
      } else if (this.model) {
        // Use Gemini API
        const generationConfig = {
          temperature: 0.7,
          maxOutputTokens: 500,
        };
        
        const result = await this.model.generateContent({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        });
        
        const response = result.response;
        const coverLetter = response.text().trim();
        return coverLetter;
      } else {
        throw new Error('No AI API key configured. Please set OPENAI_API_KEY or GEMINI_API_KEY in .env');
      }
    } catch (error) {
      console.error('AI API error:', error);
      throw new Error('Failed to generate cover letter');
    }
  }

  buildPrompt(userProfile, jobDescription) {
    const { name, skills, experience, projects, education, keywords } = userProfile;
    
    let prompt = `Write a professional cover letter for ${name} applying for this position.\n\n`;
    
    prompt += `Job Description:\n${jobDescription}\n\n`;
    
    prompt += `Candidate Profile:\n`;
    prompt += `Name: ${name}\n`;
    
    if (skills && skills.length > 0) {
      prompt += `Skills: ${skills.join(', ')}\n`;
    }
    
    if (experience && experience.length > 0) {
      prompt += `Experience:\n`;
      experience.forEach(exp => {
        prompt += `- ${exp.title} at ${exp.company}`;
        if (exp.description) {
          prompt += `: ${exp.description}`;
        }
        prompt += '\n';
      });
    }
    
    if (projects && projects.length > 0) {
      prompt += `Projects:\n`;
      projects.forEach(project => {
        prompt += `- ${project.title}`;
        if (project.description) {
          prompt += `: ${project.description}`;
        }
        if (project.technologies && project.technologies.length > 0) {
          prompt += ` (Technologies: ${project.technologies.join(', ')})`;
        }
        prompt += '\n';
      });
    }
    
    if (education && education.length > 0) {
      prompt += `Education:\n`;
      education.forEach(edu => {
        prompt += `- ${edu.degree} from ${edu.institution}\n`;
      });
    }
    
    if (keywords && keywords.length > 0) {
      prompt += `Career Interests: ${keywords.join(', ')}\n`;
    }
    
    prompt += `\nInstructions:\n`;
    prompt += `1. Address the letter to "Hiring Manager"\n`;
    prompt += `2. Start with a strong opening that shows enthusiasm for the role\n`;
    prompt += `3. Highlight the most relevant skills and experience that match the job requirements\n`;
    prompt += `4. Mention specific achievements or projects that demonstrate capability\n`;
    prompt += `5. Keep it concise (200-300 words)\n`;
    prompt += `6. End with a professional closing and call to action\n`;
    prompt += `7. Make it personalized and engaging, not generic\n\n`;
    
    prompt += `Cover Letter:`;
    
    return prompt;
  }

  async generateMultipleVersions(userProfile, jobDescription, count = 3) {
    const versions = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const coverLetter = await this.generateCoverLetter(userProfile, jobDescription);
        versions.push({
          version: i + 1,
          content: coverLetter
        });
      } catch (error) {
        console.error(`Error generating version ${i + 1}:`, error);
      }
    }
    
    return versions;
  }

  validateInputs(userProfile, jobDescription) {
    if (!userProfile || !jobDescription) {
      throw new Error('User profile and job description are required');
    }
    
    if (!userProfile.name) {
      throw new Error('User name is required');
    }
    
    if (jobDescription.length < 10) {
      throw new Error('Job description is too short');
    }
    
    return true;
  }
}

module.exports = CoverLetterGenerator;
