-- Add INSERT policy for profiles table to allow profile creation during signup
CREATE POLICY "Allow profile creation during signup" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
